package edu.upenn.cis.nets2120.hw3.spark;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.concurrent.ExecutionException;

import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.config.ConfigSingleton;
import edu.upenn.cis.nets2120.hw3.spark.SparkConnector;
import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;

public abstract class SparkJob<T> implements Job<T> {
    private static final long serialVersionUID = 1L;

    protected FlexibleLogger logger;

    protected transient SparkSession spark;
    protected transient JavaSparkContext context;

    protected boolean isLocal = true;
    boolean run_with_debug = false;

    public SparkJob(FlexibleLogger logger, boolean isLocal, boolean debug) {
        System.setProperty("file.encoding", "UTF-8");
        this.isLocal = isLocal;
        this.run_with_debug = debug;

        this.logger = logger;
    }


    public void initialize() throws IOException, InterruptedException {
        if (this.logger == null) {
            System.out.println("WARN: Logger lost in SparkJob.initialize(), using System.out.");
        } else {
             logger.info("Connecting to Spark...");
        }

        if (this.spark == null || this.spark.sparkContext().isStopped() ) {
            this.spark = SparkConnector.getSparkConnection();
        }
        if (this.context == null || this.context.sc().isStopped()) {
            this.context = SparkConnector.getSparkContext();
        }

        if (this.spark == null) {
            if (logger != null) logger.error("SparkSession could not be initialized by SparkConnector.");
            else System.err.println("SparkSession could not be initialized by SparkConnector.");
            throw new IOException("SparkSession failed to initialize in SparkJob.");
        }
        if (this.context == null && this.spark != null && !this.spark.sparkContext().isStopped()) {
            if (logger != null) logger.error("JavaSparkContext could not be initialized by SparkConnector, attempting to create from existing SparkSession.");
            else System.err.println("JavaSparkContext could not be initialized by SparkConnector, attempting to create from existing SparkSession.");
            this.context = new JavaSparkContext(this.spark.sparkContext());
        }
        if (this.context == null) {
             if (logger != null) logger.error("JavaSparkContext could not be initialized.");
             else System.err.println("JavaSparkContext could not be initialized.");
            throw new IOException("JavaSparkContext failed to initialize in SparkJob.");
        }

        if (logger != null) logger.debug("Connected!");
        else System.out.println("SparkJob Initialized: Connected!");
    }

    public abstract T run(boolean debug) throws Exception;

    public void shutdown() {
        logger.info("Shutting down");

        if (isLocal && spark != null)
            spark.close();
    }

    public T mainLogic() {
        if (!isLocal)
            throw new RuntimeException("mainLogic() should not be called on a Livy Job");

        try {
            initialize();

            return run(run_with_debug);
        } catch (final IOException ie) {
            logger.error("I/O error: ");
            ie.printStackTrace();
            return null;
        } catch (final Exception e) {
            e.printStackTrace();
            return null;
        } finally {
            shutdown();
        }
    }

    @Override
    public T call(JobContext jobCtx) throws Exception {
        initialize();
        return run(run_with_debug);
    }


    public static String getLivyUrl(String[] optArgs) {
        String livy = "http://ec2-44-202-26-172.compute-1.amazonaws.com:8998/";

        if (optArgs.length > 0) {
            livy = optArgs[0];
        } else if (System.getenv("host") != null) {
            livy = System.getenv("LIVY_HOST");
        }

        if (!livy.startsWith("http://"))
            livy = "http://" + livy;


        return livy;
    }

    public static <T> T runJob(String livyUrl, SparkJob<T> job) throws IOException, URISyntaxException, InterruptedException, ExecutionException {

        LivyClient client = new LivyClientBuilder()
                .setURI(new URI(livyUrl))
                .build();

        try {
            String jar = Config.JAR;

            System.out.printf("Uploading %s to the Spark context...\n", jar);
            client.uploadJar(new File(jar)).get();

            System.out.printf("Running job...\n");
            T result = client.submit(job).get();

            return result;
        } finally {
            client.stop(true);
        }
    }
}
