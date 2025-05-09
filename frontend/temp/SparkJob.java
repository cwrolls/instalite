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

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.spark.SparkConnector;
import edu.upenn.cis.nets2120.hw3.utils.FlexibleLogger;

public abstract class SparkJob<T> implements Job<T> {
    private static final long serialVersionUID = 1L;

    protected FlexibleLogger logger;

    protected SparkSession spark;
    protected JavaSparkContext context;
    protected Config config;

    protected boolean isLocal = true;
    boolean run_with_debug = false;

    public SparkJob(FlexibleLogger logger, Config config, boolean isLocal, boolean debug) {
        System.setProperty("file.encoding", "UTF-8");
        this.isLocal = isLocal;
        this.config = config;
        this.run_with_debug = debug;

        this.logger = logger;
    }

    public void initialize() throws IOException, InterruptedException {
        logger.info("Connecting to Spark...");

        spark = SparkConnector.getSparkConnection(config);
        context = SparkConnector.getSparkContext(config);

        logger.debug("Connected!");
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
    public T call(JobContext arg0) throws Exception {
        initialize();
        return run(run_with_debug);
    }

    public static String getLivyUrl(String[] optArgs) {
        String livy = null;
        
        if (System.getenv("LIVY_HOST") != null && !System.getenv("LIVY_HOST").isEmpty()) {
            livy = System.getenv("LIVY_HOST");
            System.out.println("Using LIVY_HOST from environment: " + livy);
        } else {
            livy = "http://ec2-44-202-26-172.compute-1.amazonaws.com:8998/"; 
            System.out.println("LIVY_HOST environment variable not set, defaulting to: " + livy);
        }

        if (!livy.startsWith("http://") && !livy.startsWith("https://")) {
            livy = "http://" + livy;
        }
        try {
            URI uri = new URI(livy);
            if (uri.getPort() == -1) {
                livy = livy + ":8998"; 
                System.out.println("Appending default Livy port 8998: " + livy);
            }
        } catch (URISyntaxException e) {
            System.err.println("Warning: Could not parse Livy URL to check port: " + livy + " - " + e.getMessage());
            if (!livy.matches(".*://.*:.*$")) {
                 livy = livy + ":8998";
                 System.out.println("Appending default Livy port 8998 based on pattern: " + livy);
            }
        }

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
