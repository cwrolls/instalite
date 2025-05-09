package edu.upenn.cis.nets2120.hw3.livy;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintStream;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;

import edu.upenn.cis.nets2120.hw3.spark.SparkJob;
import edu.upenn.cis.nets2120.hw3.spark.SocialRankLivyJob;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.config.ConfigSingleton;

public class ComputeRanksLivy {
    static Logger logger = LogManager.getLogger(ComputeRanksLivy.class);



    public static void main(String[] args)
            throws IOException, URISyntaxException, InterruptedException, ExecutionException {
        boolean debug = false;
        
        String inputPath = "social_net.txt";
        double d_max = 30.0; 
        int i_max = 15;
        int topN = 10; 

        
        int argOffset = 0;
        if (args.length > 0) {
            if (args[0].equalsIgnoreCase("true") || args[0].equalsIgnoreCase("false")) {
                debug = Boolean.parseBoolean(args[0]);
                argOffset = 1;
            }
            if (args.length > argOffset) {
                try {
                    i_max = Integer.parseInt(args[argOffset]);
                } catch (NumberFormatException e) {
                    logger.warn("Could not parse i_max from args[" + argOffset + "]: '" + args[argOffset] + "'. Using default: " + i_max);
                }
            }
        }

        Config config = ConfigSingleton.getInstance();

        if (config.LIVY_HOST == null) {
            logger.error("LIVY_HOST not set -- update your .env and run source .env");
            System.exit(-1);
        }
        
        String livy = SparkJob.getLivyUrl(args); 
        FlexibleLogger flexLogger = new FlexibleLogger(null, false, debug);

        System.out.println("Attempting to submit SocialRankLivyJob using Livy at: " + livy);
        logger.info("Attempting to submit SocialRankLivyJob using Livy at: " + livy);
        logger.info("Job Parameters: inputPath=" + inputPath + ", d_max=" + d_max + 
                           ", i_max=" + i_max + ", topN=" + topN + ", debug(Livy wrapper)=" + debug);

        SocialRankLivyJob socialRankLivyJob = new SocialRankLivyJob(inputPath, d_max, i_max, topN, 
                                                                  flexLogger, /* config, */ false, debug);
        
        try {
            logger.info("Submitting SocialRankLivyJob to Livy...");
            Integer result = SparkJob.runJob(livy, socialRankLivyJob);
            logger.info("SocialRankLivyJob completed successfully via Livy with result: " + result);
            System.out.println("SocialRankLivyJob completed successfully via Livy with result: " + result);
        } catch (Exception e) {
            logger.error("ERROR running SocialRankLivyJob via Livy:", e);
            System.err.println("ERROR running SocialRankLivyJob via Livy:");
            e.printStackTrace();
        }

    }
}
