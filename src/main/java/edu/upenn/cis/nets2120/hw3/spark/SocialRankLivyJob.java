package edu.upenn.cis.nets2120.hw3.spark;

import org.apache.spark.api.java.*;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import scala.Tuple2;
import scala.Tuple3;

import java.util.*;
import java.util.stream.Collectors;

import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import edu.upenn.cis.nets2120.hw3.spark.config.ConfigSingleton;
import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;

public class SocialRankLivyJob extends SparkJob<Integer> {
    private String inputPath;
    private double dmax;
    private int imax; 
    private int topN; 

    public SocialRankLivyJob(String inputPath, double dmax, int imax, int topN,
                             FlexibleLogger logger, boolean isLocal, boolean debugSuper) {
        super(logger, isLocal, debugSuper);
        this.inputPath = inputPath; 
        this.dmax = dmax;    
        this.imax = imax;
        this.topN = topN; 
        
        super.logger.info("SocialRankLivyJob instantiated with: inputPath=" + inputPath +
                               ", dmax=" + dmax + ", imax=" + imax + ", topN=" + topN +
                               ", isLocal=" + isLocal + ", debugSuper=" + debugSuper);
    }

    @Override
    public Integer run(boolean debugMode) throws Exception {
        super.logger.info("SocialRankLivyJob.run() started. debugMode=" + debugMode);

        String DB_URL = "jdbc:mysql://instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com:3306/instalite";
        String DB_USER = "nets2120project";
        String DB_PASSWORD = "nets2120project";

        SparkSession spark = super.spark;
        if (spark == null || spark.sparkContext().isStopped()) {
            super.logger.info("SparkSession is null or stopped in SocialRankLivyJob.run(). Initializing...");
            SparkSession.Builder builder = SparkSession.builder().appName("SocialRankLivyJob");
            spark = builder.getOrCreate();
            super.spark = spark;
            super.logger.info("SparkSession re-initialized in SocialRankLivyJob.");
        } else {
            super.logger.info("Using existing SparkSession in SocialRankLivyJob.");
        }

        JavaSparkContext sc = super.context;
        if (sc == null || sc.sc().isStopped()) {
            super.logger.info("JavaSparkContext is null or stopped in SocialRankLivyJob.run(). Initializing...");
            sc = new JavaSparkContext(spark.sparkContext());
            super.context = sc; 
            super.logger.info("JavaSparkContext re-initialized in SocialRankLivyJob.");
        } else {
            super.logger.info("Using existing JavaSparkContext in SocialRankLivyJob.");
        }
        
        super.logger.info("SocialRankLivyJob effective parameters: imax=" + this.imax);

        Properties connectionProperties = new Properties();
        String jdbcUrl;

        jdbcUrl = DB_URL;
        connectionProperties.put("user", DB_USER);
        connectionProperties.put("password", DB_PASSWORD);
        connectionProperties.put("driver", "com.mysql.cj.jdbc.Driver");
        super.logger.info("Using hardcoded DB connection: " + jdbcUrl.substring(0, jdbcUrl.indexOf("?") > 0 ? jdbcUrl.indexOf("?") : jdbcUrl.length()));
        
        // users
        Dataset<Row> users = spark.read().jdbc(jdbcUrl, "users", connectionProperties);
        JavaRDD<String> userNodes = users.javaRDD().map(row -> "u_" + row.getAs("user_id").toString()).distinct();
        super.logger.info("Loaded " + userNodes.count() + " user nodes.");

        // posts
        Dataset<Row> posts = spark.read().jdbc(jdbcUrl, "posts", connectionProperties);
        Dataset<Row> federatedPosts = spark.read().jdbc(jdbcUrl, "federated_posts", connectionProperties);
        JavaRDD<String> localPostNodes = posts.javaRDD().map(row -> "p_" + row.getAs("post_id").toString());
        JavaRDD<String> fedPostNodes = federatedPosts.javaRDD().map(row -> "p_" + row.getAs("post_id").toString());
        JavaRDD<String> postNodes = localPostNodes.union(fedPostNodes).distinct();
        super.logger.info("Loaded " + postNodes.count() + " post nodes (including federated).");
        
        // hashtags
        Dataset<Row> hashtags = spark.read().jdbc(jdbcUrl, "hashtags", connectionProperties);
        JavaRDD<String> hashtagNodes = hashtags.javaRDD().map(row -> "h_" + row.getAs("name").toString()).distinct();
        super.logger.info("Loaded " + hashtagNodes.count() + " hashtag nodes.");

        // friendships
        Dataset<Row> friendships = spark.read().jdbc(jdbcUrl, "friendships", connectionProperties);
        JavaRDD<Tuple2<String, String>> friendEdges1 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user1_id").toString(), "u_" + row.getAs("user2_id").toString()));
        JavaRDD<Tuple2<String, String>> friendEdges2 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user2_id").toString(), "u_" + row.getAs("user1_id").toString()));
        JavaRDD<Tuple2<String, String>> friendshipEdges = friendEdges1.union(friendEdges2).distinct();
        super.logger.info("Processed " + friendshipEdges.count() + " distinct friendship edges.");
        
        // user intersts
        Dataset<Row> userInterests = spark.read().jdbc(jdbcUrl, "user_interests", connectionProperties);
        JavaRDD<Tuple2<String, String>> interestEdges1 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> interestEdges2 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> userInterestEdges = interestEdges1.union(interestEdges2).distinct();
        super.logger.info("Processed " + userInterestEdges.count() + " distinct user interest edges.");

        // post hashtags
        Dataset<Row> postHashtags = spark.read().jdbc(jdbcUrl, "post_hashtags", connectionProperties);
        JavaRDD<Tuple2<String, String>> postTagEdges1 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> postTagEdges2 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> postHashtagEdges = postTagEdges1.union(postTagEdges2).distinct();
        super.logger.info("Processed " + postHashtagEdges.count() + " distinct post hashtag edges.");

        // likes
        Dataset<Row> likes = spark.read().jdbc(jdbcUrl, "likes", connectionProperties);
        JavaRDD<Tuple2<String, String>> likeEdges1 = likes.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> likeEdges2 = likes.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> likeEdges = likeEdges1.union(likeEdges2).distinct();
        super.logger.info("Processed " + likeEdges.count() + " distinct like edges.");

        // combine all
        JavaRDD<Tuple2<String, String>> allEdgesRDD = friendshipEdges
            .union(userInterestEdges)
            .union(postHashtagEdges)
            .union(likeEdges)
            .distinct();
        super.logger.info("Total distinct edges in graph: " + allEdgesRDD.count());

        JavaPairRDD<String, Iterable<String>> adjacencyList = JavaPairRDD.fromJavaRDD(allEdgesRDD).groupByKey().cache();
        super.logger.info("Created adjacency list. Number of nodes in adjacency list: " + adjacencyList.count());
        
        // init adsorption
        JavaPairRDD<String, Map<String, Double>> ranks = userNodes
            .mapToPair(userId -> {
                Map<String, Double> initialWeight = new HashMap<>();
                initialWeight.put(userId, 1.0); 
                return new Tuple2<>(userId, initialWeight);
            });
        super.logger.info("Initialized ranks for " + ranks.count() + " user nodes.");

        int maxIterations = this.imax; 

        for (int iter = 0; iter < maxIterations; iter++) {
            long iterationStartTime = System.currentTimeMillis();
            super.logger.info("Starting Adsorption Iteration: " + (iter + 1) + "/" + maxIterations);

            JavaPairRDD<String, Tuple2<Map<String, Double>, Iterable<String>>> nodeWeightsAndNeighbors =
                ranks.join(adjacencyList);

            JavaPairRDD<String, Map<String, Double>> messages = nodeWeightsAndNeighbors
                .flatMapToPair(t -> {
                    String nodeJ = t._1;                         
                    Map<String, Double> weightsJ = t._2._1;      
                    Iterable<String> neighborsI = t._2._2;       

                    List<Tuple2<String, Map<String, Double>>> outgoingMessages = new ArrayList<>();
                    List<String> neighborList = new ArrayList<>();
                    neighborsI.forEach(neighborList::add);

                    if (neighborList.isEmpty()) {
                        return outgoingMessages.iterator(); 
                    }

                    long numNeighbors = neighborList.size();
                    long numHashtagNeighbors = neighborList.stream().filter(n -> n.startsWith("h_")).count();
                    long numPostNeighbors = neighborList.stream().filter(n -> n.startsWith("p_")).count();
                    long numUserNeighbors = neighborList.stream().filter(n -> n.startsWith("u_")).count();

                    for (String nodeI : neighborList) {
                        double weightJI = 0.0; 

                        if (nodeJ.startsWith("u_")) { 
                            if (nodeI.startsWith("h_") && numHashtagNeighbors > 0) {
                                weightJI = 0.3 / numHashtagNeighbors;
                            } else if (nodeI.startsWith("p_") && numPostNeighbors > 0) {
                                weightJI = 0.4 / numPostNeighbors;
                            } else if (nodeI.startsWith("u_") && numUserNeighbors > 0) {
                                weightJI = 0.3 / numUserNeighbors;
                            }
                        } else if (nodeJ.startsWith("h_")) { 
                            if (numNeighbors > 0) weightJI = 1.0 / numNeighbors;
                        } else if (nodeJ.startsWith("p_")) { 
                            if (numNeighbors > 0) weightJI = 1.0 / numNeighbors;
                        }
                        
                        if (weightJI > 0) {
                            Map<String, Double> propagatedWeights = new HashMap<>();
                            for (Map.Entry<String, Double> userWeightEntry : weightsJ.entrySet()) {
                                propagatedWeights.put(userWeightEntry.getKey(), userWeightEntry.getValue() * weightJI);
                            }
                            outgoingMessages.add(new Tuple2<>(nodeI, propagatedWeights));
                        }
                    }
                    return outgoingMessages.iterator();
                });

            JavaPairRDD<String, Map<String, Double>> newRanks = messages.reduceByKey((map1, map2) -> {
                Map<String, Double> merged = new HashMap<>(map1);
                map2.forEach((user, weight) -> merged.merge(user, weight, Double::sum));
                return merged;
            });
            
            if (iter < maxIterations -1 ) {
                if (ranks != null && !ranks.equals(userNodes.mapToPair(userId -> new Tuple2<>(userId, new HashMap<String, Double>())))) { 
                     ranks.unpersist(false);
                }
                 ranks = newRanks.cache(); 
            } else {
                ranks = newRanks; 
            }
            long iterationEndTime = System.currentTimeMillis();
            super.logger.info("Adsorption Iteration " + (iter + 1) + " completed in " + (iterationEndTime - iterationStartTime) + " ms. Current ranks RDD has " + ranks.count() + " entries.");
        }
        
        JavaPairRDD<String, Map<String, Double>> postRanks = ranks
            .filter(t -> t._1.startsWith("p_"));
        super.logger.info("Filtered for post ranks. Number of post nodes with ranks: " + postRanks.count());

        JavaRDD<Tuple3<String, String, Double>> rankingsToSave = postRanks
            .flatMap(t -> {
                String postId = t._1; 
                Map<String, Double> userWeights = t._2;
                List<Tuple3<String, String, Double>> results = new ArrayList<>();
                String numericPostId = postId.substring(2);
                for (Map.Entry<String, Double> entry : userWeights.entrySet()) {
                    String userId = entry.getKey(); 
                    String numericUserId = userId.substring(2);
                    Double rankValue = entry.getValue();
                    if (rankValue > 1E-6) { 
                        results.add(new Tuple3<>(numericPostId, numericUserId, rankValue));
                    }
                }
                return results.iterator();
            });
        
        long rankingsToSaveCount = rankingsToSave.count(); 
        super.logger.info("Prepared " + rankingsToSaveCount + " ranking entries to save to DB.");

        // save to db
        final String finalJdbcUrl = jdbcUrl;
        final Properties finalConnectionProperties = connectionProperties; 

        rankingsToSave.foreachPartition(iterator -> {
            String dbUrlPartition;
            Properties propsPartition = new Properties();

            dbUrlPartition = finalJdbcUrl + (finalJdbcUrl.contains("?") ? "&" : "?") + "rewriteBatchedStatements=true";
            propsPartition.setProperty("user", finalConnectionProperties.getProperty("user"));
            propsPartition.setProperty("password", finalConnectionProperties.getProperty("password"));
            propsPartition.setProperty("driver", "com.mysql.cj.jdbc.Driver");

            java.sql.Connection conn = null;
            java.sql.PreparedStatement pstmt = null;
            int batchSize = 1000; 

            try {
                conn = java.sql.DriverManager.getConnection(dbUrlPartition, propsPartition);
                conn.setAutoCommit(false); 

                String sql = "INSERT INTO post_rankings (post_id, user_id, rank_score, updated_at) VALUES (?, ?, ?, NOW()) " +
                            "ON DUPLICATE KEY UPDATE rank_score = VALUES(rank_score), updated_at = NOW()";
                pstmt = conn.prepareStatement(sql);

                int count = 0;
                int partitionTotalSaved = 0;
                while (iterator.hasNext()) {
                    Tuple3<String, String, Double> record = iterator.next();
                    try {
                        pstmt.setInt(1, Integer.parseInt(record._1())); 
                        pstmt.setInt(2, Integer.parseInt(record._2())); 
                        pstmt.setDouble(3, record._3());
                        pstmt.addBatch();
                        count++;
                        partitionTotalSaved++;

                        if (count % batchSize == 0) {
                            pstmt.executeBatch();
                            conn.commit();
                            count = 0; 
                        }
                    } catch (NumberFormatException nfe) {
                        System.err.println("Skipping record due to NumberFormatException: post_id=" + record._1() + ", user_id=" + record._2() + ". Error: " + nfe.getMessage());
                    }
                }
                if (count > 0) { 
                    pstmt.executeBatch();
                    conn.commit();
                }
                 System.out.println("Partition finished saving " + partitionTotalSaved + " records.");

            } catch (Exception e) {
                System.err.println("Error saving rankings partition to DB: " + e.getMessage());
                e.printStackTrace(); 
                if (conn != null) {
                    try { conn.rollback(); } catch (java.sql.SQLException se) { System.err.println("Rollback failed: " + se.getMessage()); }
                }
                throw new RuntimeException("Error in foreachPartition while saving to DB", e); 
            } finally {
                if (pstmt != null) try { pstmt.close(); } catch (java.sql.SQLException se) {  }
                if (conn != null) try { conn.close(); } catch (java.sql.SQLException se) {}
            }
        });

        super.logger.info("Finished calculating and saving post rankings. Job exiting.");
        return 0; 
    }
} 