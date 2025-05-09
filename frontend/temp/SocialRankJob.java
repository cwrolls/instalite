package edu.upenn.cis.nets2120.hw3.spark;

import org.apache.spark.api.java.*;
import org.apache.spark.api.java.function.*;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import scala.Tuple2;
import scala.Tuple3;

import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.*;
import java.util.stream.Collectors;

public class SocialRankJob {
    private static final double DECAY = 0.15;

    public static void main(String[] args) throws Exception {
        String inputPath = args.length > 0 ? args[0] : "social_net.txt";
        double dmax = args.length > 1 ? Double.parseDouble(args[1]) : 30.0;
        int imax = args.length > 2 ? Integer.parseInt(args[2]) : 25;
        boolean debug = args.length > 3 && Boolean.parseBoolean(args[3]);
        int topN = args.length > 4 ? Integer.parseInt(args[4]) : 10;

        SparkSession spark = SparkSession.builder().appName("SocialRank").getOrCreate();
        JavaSparkContext sc = new JavaSparkContext(spark.sparkContext());

        Properties connectionProperties = new Properties();
        connectionProperties.put("user", "nets2120project");
        connectionProperties.put("password", "nets2120project");
        connectionProperties.put("driver", "com.mysql.cj.jdbc.Driver");

        String jdbcUrl = "jdbc:mysql://instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com:3306/instalite";
        
        Dataset<Row> users = spark.read().jdbc(jdbcUrl, "users", connectionProperties);
        JavaRDD<String> userNodes = users.javaRDD().map(row -> "u_" + row.getAs("user_id").toString()).distinct();

        Dataset<Row> posts = spark.read().jdbc(jdbcUrl, "posts", connectionProperties);
        Dataset<Row> federatedPosts = spark.read().jdbc(jdbcUrl, "federated_posts", connectionProperties);
        JavaRDD<String> federatedPostNodes = federatedPosts.javaRDD()
            .map(row -> "p_" + row.getAs("post_id").toString())
            .distinct();
        JavaRDD<String> postNodes = posts.javaRDD()
            .map(row -> "p_" + row.getAs("post_id").toString())
            .union(federatedPostNodes)
            .distinct();

        Dataset<Row> hashtags = spark.read().jdbc(jdbcUrl, "hashtags", connectionProperties);
        JavaRDD<String> hashtagNodes = hashtags.javaRDD().map(row -> "h_" + row.getAs("name").toString()).distinct();

        Dataset<Row> friendships = spark.read().jdbc(jdbcUrl, "friendships", connectionProperties);
        JavaRDD<Tuple2<String, String>> friendEdges1 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user1_id").toString(), "u_" + row.getAs("user2_id").toString()));
        JavaRDD<Tuple2<String, String>> friendEdges2 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user2_id").toString(), "u_" + row.getAs("user1_id").toString()));
        JavaRDD<Tuple2<String, String>> friendshipEdges = friendEdges1.union(friendEdges2).distinct();


        Dataset<Row> userInterests = spark.read().jdbc(jdbcUrl, "user_interests", connectionProperties);
        JavaRDD<Tuple2<String, String>> interestEdges1 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> interestEdges2 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> userInterestEdges = interestEdges1.union(interestEdges2).distinct();
        
        Dataset<Row> postHashtags = spark.read().jdbc(jdbcUrl, "post_hashtags", connectionProperties);
        JavaRDD<Tuple2<String, String>> postTagEdges1 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> postTagEdges2 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> postHashtagEdges = postTagEdges1.union(postTagEdges2).distinct();

        Dataset<Row> likes = spark.read().jdbc(jdbcUrl, "likes", connectionProperties);
        JavaRDD<Tuple2<String, String>> likeEdges1 = likes.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> likeEdges2 = likes.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> likeEdges = likeEdges1.union(likeEdges2).distinct();

        JavaRDD<Tuple2<String, String>> allEdgesRDD = friendshipEdges
            .union(userInterestEdges)
            .union(postHashtagEdges)
            .union(likeEdges)
            .distinct();

        JavaPairRDD<String, Iterable<String>> adjacencyList = JavaPairRDD.fromJavaRDD(allEdgesRDD).groupByKey().cache();
        
        JavaPairRDD<String, Map<String, Double>> ranks = userNodes
            .mapToPair(userId -> {
                Map<String, Double> initialWeight = new HashMap<>();
                initialWeight.put(userId, 1.0);
                return new Tuple2<>(userId, initialWeight);
            });

        int maxIterations = 15; 

        for (int iter = 0; iter < maxIterations; iter++) {
            System.out.println("Starting Adsorption Iteration: " + (iter + 1));

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

            ranks = messages.reduceByKey((map1, map2) -> {
                Map<String, Double> merged = new HashMap<>(map1);
                map2.forEach((user, weight) -> merged.merge(user, weight, Double::sum));
                return merged;
            });

            ranks.cache();
        }

        JavaPairRDD<String, Map<String, Double>> postRanks = ranks
            .filter(t -> t._1.startsWith("p_"));

        JavaRDD<Tuple3<String, String, Double>> rankingsToSave = postRanks
            .flatMap(t -> {
                String postId = t._1; 
                Map<String, Double> userWeights = t._2;
                List<Tuple3<String, String, Double>> results = new ArrayList<>();
                String numericPostId = postId.substring(2);
                for (Map.Entry<String, Double> entry : userWeights.entrySet()) {
                    String userId = entry.getKey(); 
                    String numericUserId = userId.substring(2);
                    Double rank = entry.getValue();
                    results.add(new Tuple3<>(numericPostId, numericUserId, rank));
                }
                return results.iterator();
            });

        rankingsToSave.foreachPartition(iterator -> {

            List<Tuple3<String, String, Double>> batch = new ArrayList<>();
            int batchSize = 1000;

            String dbUrl = "jdbc:mysql://instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com:3306/instalite?rewriteBatchedStatements=true";
            Properties props = new Properties();
            props.setProperty("user", "nets2120project");
            props.setProperty("password", "nets2120project");
            props.setProperty("driver", "com.mysql.cj.jdbc.Driver"); 

            java.sql.Connection conn = null;
            java.sql.PreparedStatement pstmt = null;

            try {
                conn = java.sql.DriverManager.getConnection(dbUrl, props);
                conn.setAutoCommit(false); 

                String sql = "INSERT INTO post_rankings (post_id, user_id, rank_score, updated_at) VALUES (?, ?, ?, NOW()) " +
                            "ON DUPLICATE KEY UPDATE rank_score = VALUES(rank_score), updated_at = NOW()";
                pstmt = conn.prepareStatement(sql);

                int count = 0;
                while (iterator.hasNext()) {
                    Tuple3<String, String, Double> record = iterator.next();
                    pstmt.setInt(1, Integer.parseInt(record._1()));
                    pstmt.setInt(2, Integer.parseInt(record._2()));
                    pstmt.setDouble(3, record._3());
                    pstmt.addBatch();
                    count++;

                    if (count % batchSize == 0) {
                        pstmt.executeBatch();
                        conn.commit();
                        System.out.println("Committed batch of " + batchSize);
                    }
                }
                pstmt.executeBatch();
                conn.commit();
                System.out.println("Committed final batch.");

            } catch (Exception e) {
                System.err.println("Error saving rankings partition to DB: " + e.getMessage());
                if (conn != null) {
                    try { conn.rollback(); } catch (java.sql.SQLException se) {  }
                }
                throw new RuntimeException(e); 
            } finally {
                if (pstmt != null) try { pstmt.close(); } catch (java.sql.SQLException se) {}
                if (conn != null) try { conn.close(); } catch (java.sql.SQLException se) {  }
            }
        });

        System.out.println("Finished calculating and saving post rankings.");
        spark.stop();
    }
}