package edu.upenn.cis.nets2120.hw3.spark.local;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.config.ConfigSingleton;
import edu.upenn.cis.nets2120.hw3.spark.SocialRankJob;
import edu.upenn.cis.nets2120.hw3.spark.utils.SerializablePair;
import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;
import edu.upenn.cis.nets2120.hw3.spark.SparkJob;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileOutputStream;
import java.io.PrintStream;
import java.util.*;

import javax.security.auth.login.ConfigurationSpi;

public class ComputeRanksLocal {
    static Logger logger = LogManager.getLogger(ComputeRanksLocal.class);

    public static void main(String[] args) {
        boolean debug = false;
        double d_max = 30;
        int i_max = 25;
        String inputPath = "social_net.txt";
        int topN = 10;
        Config config = ConfigSingleton.getInstance();

         if (args.length == 1) {
            inputPath = args[0];
        } else if (args.length == 2) {
            inputPath = args[0];
            d_max = Double.parseDouble(args[0]);
                       
        } else if (args.length == 3) {
            inputPath = args[0];
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
        } 
        else if (args.length == 4) {
            inputPath = args[0];
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug  = Boolean.parseBoolean(args[2]);
        } else if (args.length == 5) {
            inputPath = args[0];
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug  = Boolean.parseBoolean(args[2]);
            topN   = Integer.parseInt(args[3]);
        } else {
            d_max = 30;
            i_max = 25;
            debug = false;
        }

        FlexibleLogger rankLogger = new FlexibleLogger(LogManager.getLogger(SparkJob.class), true, debug);
        String path = "file://" + System.getProperty("user.dir") + "/src/main/java/edu/upenn/cis/nets2120/hw3/simple-example.txt";
        config.setSocialPath(path);

        
        SocialRankJob job = new SocialRankJob(inputPath,d_max, i_max, topN, debug, true, rankLogger);

       Integer topK = job.mainLogic();
        logger.info("*** Finished social network ranking! ***");

      }

}
