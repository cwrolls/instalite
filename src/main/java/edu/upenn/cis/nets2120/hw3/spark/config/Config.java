package edu.upenn.cis.nets2120.hw3.spark.config;

/**
 * Global configuration for NETS 2120 homeworks.
 *
 * @author zives
 */
public class Config {
    // For test drivers
    public static void setSocialPath(String path) {
        SOCIAL_NET_PATH = path;
    }

    /**
     * The path to the space-delimited social network data
     */
    public static String SOCIAL_NET_PATH = "s3a://nets2120-images/movie_friends.txt";

    public static String LOCAL_SPARK = "local[*]";

    public static String JAR = "target/instalite-spark-1.0-SNAPSHOT.jar";

    public static String DATABASE_CONNECTION = null;
    public static String DATABASE_USERNAME = null;
    public static String DATABASE_PASSWORD = null;
    public static String CHROMA_CLIENT_PORT = null;

    public static String SPARK_APP_NAME = "IMDBRelations";
    public static String SPARK_MASTER_URL = "local[*]";
    public static String SPARK_DRIVER_MEMORY = "10g";
    public static String SPARK_TESTING_MEMORY = "2147480000";

    public static Integer FIRST_N_ROWS = 1000;

    // these will be set via environment variables
    public static String ACCESS_KEY_ID = null;
    public static String SECRET_ACCESS_KEY = null;
    public static String SESSION_TOKEN = null;

    public static String LIVY_HOST = "http://ec2-44-202-26-172.compute-1.amazonaws.com:8998/";

    /**
     * How many RDD partitions to use?
     */
    public static int PARTITIONS = 5;
}
