package edu.upenn.cis.nets2120.hw3.spark;

import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;

public class SimpleTestJob extends SparkJob<Long> {

    public SimpleTestJob(FlexibleLogger logger, boolean isLocal, boolean debug) {
        super(logger, isLocal, debug);
    }

    @Override
    public Long run(boolean debugMode) throws Exception {
        SparkSession spark = super.spark; 
        if (spark == null || spark.sparkContext().isStopped()) { 
             spark = SparkSession.builder()
                .appName("SimpleTestJob")
                .getOrCreate();
        }

        JavaSparkContext sc = super.context;
        if (sc == null || sc.sc().isStopped()){
            sc = new JavaSparkContext(spark.sparkContext());
        }

        long count = sc.parallelize(java.util.Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))
                       .map(i -> i * 2)
                       .filter(i -> i > 5)
                       .count();
        
        return count;
    }

    public static void main(String[] args) {
        FlexibleLogger logger = new FlexibleLogger(null, true, true); 
        SimpleTestJob job = new SimpleTestJob(logger, true, true);
        try {
            System.out.println("Starting SimpleTestJob locally (which will call initialize and run)...");
            Long result = job.mainLogic(); 
            System.out.println("SimpleTestJob local result: " + result);
        } catch (Exception e) {
            e.printStackTrace();
        } 
    }
} 