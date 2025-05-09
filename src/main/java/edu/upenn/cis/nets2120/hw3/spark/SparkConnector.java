package edu.upenn.cis.nets2120.hw3.spark;

import java.io.File;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.SparkSession.Builder;

import com.amazonaws.auth.profile.ProfileCredentialsProvider;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.config.ConfigSingleton;

public class SparkConnector {
    static Logger logger = LogManager.getLogger(SparkConnector.class);
    static SparkSession spark = null;
    static JavaSparkContext context = null;

    public static void setSparkSession(SparkSession s) {
        spark = s;
    }

    public static void setSparkContext(JavaSparkContext c) {
        context = c;
    }

    @Deprecated
    public static synchronized SparkSession getSparkConnection(String host, Config config) {
        ConfigSingleton.getInstance();
        return SparkConnector.getSparkConnection(host); 
    }

    public static synchronized SparkSession getSparkConnection() {
         return getSparkConnection(null);
    }

    public static synchronized SparkSession getSparkConnection(String host) {
        if (spark == null) {
            ConfigSingleton.getInstance(); 

            logger.info("Attempting to create SparkSession...");
            if (System.getenv("HADOOP_HOME") == null) {
                try {
                    File workaround = new File(".");
                    System.setProperty("hadoop.home.dir", workaround.getAbsolutePath() + "/native-libs");
                    logger.info("Set hadoop.home.dir to: " + System.getProperty("hadoop.home.dir"));
                } catch (Exception e) {
                    logger.warn("Failed to set hadoop.home.dir workaround", e);
                }
            }

            String masterUrl = (host == null) ? Config.SPARK_MASTER_URL : host;
            logger.info("Using Spark master URL: " + masterUrl);
            
            SparkSession.Builder sparkBuilder = SparkSession
                    .builder()
                    .appName(Config.SPARK_APP_NAME) 
                    .master(masterUrl);

            if (Config.ACCESS_KEY_ID != null && Config.SECRET_ACCESS_KEY != null) {
                logger.info("AWS Credentials found in Config, configuring S3a");
                sparkBuilder = sparkBuilder
                    .config("spark.hadoop.fs.s3a.access.key", Config.ACCESS_KEY_ID)
                    .config("spark.hadoop.fs.s3a.secret.key", Config.SECRET_ACCESS_KEY);
                if (Config.SESSION_TOKEN != null){
                    sparkBuilder = sparkBuilder.config("spark.hadoop.fs.s3a.session.token", Config.SESSION_TOKEN);
                }
                sparkBuilder = sparkBuilder.config("spark.hadoop.fs.s3a.endpoint", "s3.us-east-1.amazonaws.com");

            } else {
                logger.info("AWS Credentials not found in Config: assuming ProfileCredentialsProvider or instance profile");
                sparkBuilder = sparkBuilder
                    .config("spark.hadoop.fs.s3a.aws.credentials.provider", "com.amazonaws.auth.profile.ProfileCredentialsProvider");
            }
            
            try {
                 spark = sparkBuilder.getOrCreate();
                 logger.info("SparkSession created successfully.");
            } catch (Exception e) {
                logger.error("Failed to create SparkSession!", e);
                throw new RuntimeException("SparkSession creation failed", e);
            }
        }

        return spark;
    }

    @Deprecated
    public static synchronized JavaSparkContext getSparkContext(Config config) {
        ConfigSingleton.getInstance(); 
        return getSparkContext(); 
    }

    public static synchronized JavaSparkContext getSparkContext() {
        if (context == null) {
            try {
                SparkSession session = getSparkConnection(); 
                if (session == null) {
                    throw new RuntimeException("Failed to get SparkSession in getSparkContext");
                }
                context = new JavaSparkContext(session.sparkContext());
                logger.info("JavaSparkContext created successfully.");
            } catch (Exception e) {
                 logger.error("Failed to create JavaSparkContext!", e);
                 throw new RuntimeException("JavaSparkContext creation failed", e);
            }
        }
        return context;
    }
}
