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
import edu.upenn.cis.nets2120.hw3.utils.FlexibleLogger;

import edu.upenn.cis.nets2120.hw3.spark.SparkJob;
import edu.upenn.cis.nets2120.hw3.spark.SocialRankJob;
import edu.upenn.cis.nets2120.hw3.utils.SerializablePair;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.config.ConfigSingleton;


public class ComputeRanksLivy {
    static Logger logger = LogManager.getLogger(ComputeRanksLivy.class);

    public static List<SerializablePair<String, Double>> callLivy(String livy, FlexibleLogger logger, Config config, double d_max, int i_max, boolean debug, boolean useBacklinks) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
        SocialRankJob job = new SocialRankJob(d_max, i_max, 10, useBacklinks, false, debug, logger, config);

        return SparkJob.runJob(livy, job);
    }

    public static void main(String[] args)
            throws IOException, URISyntaxException, InterruptedException, ExecutionException {
        boolean debug;
        double d_max;
        int i_max;

        Config config = ConfigSingleton.getInstance();

        if (config.LIVY_HOST == null) {
            logger.error("LIVY_HOST not set -- update your .env and run source .env");
            System.exit(-1);
        }

        if (args.length == 1) {
            d_max = Double.parseDouble(args[0]);
            i_max = 25;
            debug = false;
        } else if (args.length == 2) {
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug = false;
        } else if (args.length == 3) {
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug = true;
        } else {
            d_max = 30;
            i_max = 25;
            debug = false;
        }

        String livy = SparkJob.getLivyUrl(args);
        FlexibleLogger logger = new FlexibleLogger(null, false, debug);

        boolean useBacklinks = true;

        SocialRankJob job = new SocialRankJob(d_max, i_max, 10, useBacklinks, false, debug, logger, config);

        List<SerializablePair<String, Double>> result = SparkJob.runJob(livy, job);

        System.out.println("SocialRankJob result: " + result);
        try (PrintStream out = new PrintStream(new FileOutputStream("socialrank-livy.csv"))) {
            for (SerializablePair<String, Double> item : result) {
                out.println(item.getLeft() + "," + item.getRight());
            }
        } catch (Exception e) {
            logger.error("Error writing to file: " + e.getMessage());
        }
    }
}
