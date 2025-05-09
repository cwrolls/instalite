package edu.upenn.cis.nets2120.hw3.spark;

import org.apache.spark.api.java.*;
import org.apache.spark.api.java.function.*;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import java.io.Serializable;

import edu.upenn.cis.nets2120.hw3.spark.utils.FlexibleLogger;
import scala.Tuple2;
import org.apache.livy.JobContext;
import edu.upenn.cis.nets2120.hw3.spark.config.Config;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;
import org.apache.spark.broadcast.Broadcast;


public class SocialRankJob extends SparkJob<Integer> {
    private static final double DECAY = 0.15;

    String inputPath;
    double dmax;
    int imax;
    boolean debug;
    int topN;
    final double BOOST_FACTOR_2Y2B = 3200;


    public SocialRankJob(String inputPath, double dmax, int imax, int topN, boolean debug, boolean isLocal, FlexibleLogger logger ) {
        super(logger,isLocal, debug); 
        this.inputPath = inputPath;
        this.dmax = dmax;
        this.imax = imax;
        this.debug = debug;
        this.topN = topN;
    }

    static class RankingData implements Serializable {
        enum Type { REGULAR, FEDERATED, BLUESKY }
        Type type;

        Integer userId;
        Double rankScore;

        Integer localRegularPostId; 
        Integer localFederatedPostId;
        String sourceSiteForFederated; 
        String postUuidForFederated;
        String blueskyPostUri; 

        public RankingData(Integer localRegularPostId, Integer userId, Double rankScore) {
            this.type = Type.REGULAR;
            this.localRegularPostId = localRegularPostId;
            this.userId = userId;
            this.rankScore = rankScore;
        }

        public RankingData(Integer localFederatedPostId, String sourceSite, String postUuid, Integer userId, Double rankScore) {
            this.type = Type.FEDERATED;
            this.localFederatedPostId = localFederatedPostId;
            this.sourceSiteForFederated = sourceSite;
            this.postUuidForFederated = postUuid;
            this.userId = userId;
            this.rankScore = rankScore;
        }

        public RankingData(String blueskyPostUri, Integer userId, Double rankScore) {
            this.type = Type.BLUESKY;
            this.blueskyPostUri = blueskyPostUri;
            this.userId = userId;
            this.rankScore = rankScore;
        }
    }

    public Integer run(boolean debugMode) throws IOException, InterruptedException {
        this.debug = debugMode;

        SparkSession spark = SparkSession.builder().appName("SocialRank").getOrCreate();
        JavaSparkContext sc = new JavaSparkContext(spark.sparkContext());

        Properties connectionProperties = new Properties();
        connectionProperties.put("user", "nets2120project");
        connectionProperties.put("password", "nets2120project");
        connectionProperties.put("driver", "com.mysql.cj.jdbc.Driver");
        String jdbcUrl = "jdbc:mysql://instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com:3306/instalite";

        // load user nodes
        Dataset<Row> users = spark.read().jdbc(jdbcUrl, "users", connectionProperties);
        JavaRDD<String> userNodes = users.javaRDD().map(row -> "u_" + row.getAs("user_id").toString()).distinct().cache();

        // regular post nodes
        Dataset<Row> postsData = spark.read().jdbc(jdbcUrl, "posts", connectionProperties);
        JavaRDD<String> regularPostNodes = postsData.javaRDD()
            .map(row -> "p_" + row.getAs("post_id").toString())
            .distinct().cache();
        
        // federated posts nodes
        Dataset<Row> federatedPostsData = spark.read().jdbc(jdbcUrl, "federated_posts", connectionProperties);
        JavaPairRDD<String, Integer> federatedNodeToOriginalId = federatedPostsData.javaRDD()
            .mapToPair(row -> {
                String sourceId = row.getAs("source_site").toString();
                String postUuid = row.getAs("post_uuid_within_site").toString();
                Integer originalTablePostId = row.getAs("post_id"); 
                String compositeNodeId = "fp_" + sourceId + "_" + postUuid;
                return new Tuple2<>(compositeNodeId, originalTablePostId);
            }).distinct();
        JavaRDD<String> federatedPostNodes = federatedNodeToOriginalId.keys().distinct().cache();
        Map<String, Integer> federatedNodeToOriginalIdMap = federatedNodeToOriginalId.collectAsMap();
        Broadcast<Map<String, Integer>> federatedIdMapBroadcast = sc.broadcast(federatedNodeToOriginalIdMap);

        // bluesky post nodes
        Dataset<Row> blueskyPostsData = spark.read().jdbc(jdbcUrl, "Bluesky_posts", connectionProperties);
        JavaPairRDD<Row, Long> blueskyRowsWithSyntheticId = blueskyPostsData.javaRDD()
            .filter(row -> row.getAs("uri") != null && !row.getAs("uri").toString().isEmpty())
            .zipWithUniqueId();
        JavaPairRDD<String, String> blueskyNodeIdToUri = blueskyRowsWithSyntheticId
            .mapToPair(tuple -> {
                Row row = tuple._1();
                Long syntheticId = tuple._2();
                String uri = row.getAs("uri").toString();
                String nodeId = "bp_" + syntheticId.toString();
                return new Tuple2<>(nodeId, uri);
            }).cache();
        JavaRDD<String> blueskyPostNodes = blueskyNodeIdToUri.keys().distinct().cache();
        Map<String, String> blueskyNodeToUriMap = blueskyNodeIdToUri.collectAsMap();
        Broadcast<Map<String, String>> blueskyNodeToUriBroadcast = sc.broadcast(blueskyNodeToUriMap);
        
        // combine all post nodes
        JavaRDD<String> allPostNodes = regularPostNodes.union(federatedPostNodes).union(blueskyPostNodes).distinct();
        System.out.println("Post Node Counts: Regular=" + regularPostNodes.count() + 
                           ", Federated=" + federatedPostNodes.count() + 
                           ", Bluesky=" + blueskyPostNodes.count() +
                           ", Total Graph Posts=" + allPostNodes.count());
         
        // hashtag nodes
        Dataset<Row> hashtagsData = spark.read().jdbc(jdbcUrl, "hashtags", connectionProperties);
        JavaRDD<String> hashtagNodes = hashtagsData.javaRDD()
            .map(row -> "h_" + row.getAs("hashtag_id").toString()).distinct().cache();
        List<Row> collectedHashtags = hashtagsData.select("hashtag_id", "tag_text").collectAsList();

        // edges -- friends
        Dataset<Row> friendships = spark.read().jdbc(jdbcUrl, "friendships", connectionProperties);
        JavaRDD<Tuple2<String, String>> friendEdges1 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user1_id").toString(), "u_" + row.getAs("user2_id").toString()));
        JavaRDD<Tuple2<String, String>> friendEdges2 = friendships.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user2_id").toString(), "u_" + row.getAs("user1_id").toString()));
        JavaRDD<Tuple2<String, String>> friendshipEdges = friendEdges1.union(friendEdges2).distinct();
 
        // user interest edges
        Dataset<Row> userInterests = spark.read().jdbc(jdbcUrl, "user_interests", connectionProperties);
        JavaRDD<Tuple2<String, String>> interestEdges1 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> interestEdges2 = userInterests.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> userInterestEdges = interestEdges1.union(interestEdges2).distinct();
         
        // regular post hashtag edges
        Dataset<Row> postHashtags = spark.read().jdbc(jdbcUrl, "post_hashtags", connectionProperties);
        JavaRDD<Tuple2<String, String>> postTagEdges1 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "h_" + row.getAs("hashtag_id").toString()));
        JavaRDD<Tuple2<String, String>> postTagEdges2 = postHashtags.javaRDD()
            .map(row -> new Tuple2<>("h_" + row.getAs("hashtag_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> directPostHashtagEdges = postTagEdges1.union(postTagEdges2).distinct();
 
        // liked edges 
        Dataset<Row> likes = spark.read().jdbc(jdbcUrl, "likes", connectionProperties);
        JavaRDD<Tuple2<String, String>> regularLikeEdges1 = likes.javaRDD()
            .map(row -> new Tuple2<>("u_" + row.getAs("user_id").toString(), "p_" + row.getAs("post_id").toString()));
        JavaRDD<Tuple2<String, String>> regularLikeEdges2 = likes.javaRDD()
            .map(row -> new Tuple2<>("p_" + row.getAs("post_id").toString(), "u_" + row.getAs("user_id").toString()));
        JavaRDD<Tuple2<String, String>> likeEdges = regularLikeEdges1.union(regularLikeEdges2).distinct();

        JavaRDD<Tuple2<String, String>> allEdgesRDD = friendshipEdges
            .union(userInterestEdges)
            .union(directPostHashtagEdges)
            .union(likeEdges);

        List<String> allUsersSample = userNodes.take(Math.min(5, (int)userNodes.count()));
        if (!allUsersSample.isEmpty()) {
            System.out.println("DEBUG: Sample users for default connections: " + String.join(", ", allUsersSample));

            JavaRDD<String> postsNeedingDefaultEdges = federatedPostNodes.union(blueskyPostNodes).distinct();
            long countNeedy = postsNeedingDefaultEdges.count();

            if (countNeedy > 0) {
                System.out.println("DEBUG: Found " + countNeedy + " federated/bluesky posts that will receive default connections to sample users.");

                JavaRDD<Tuple2<String, String>> defaultEdges = postsNeedingDefaultEdges.flatMap(postIdNode -> {
                    List<Tuple2<String, String>> edges = new ArrayList<>();
                    for (String sampleUserNodeId : allUsersSample) {
                        edges.add(new Tuple2<>(postIdNode, sampleUserNodeId));
                        edges.add(new Tuple2<>(sampleUserNodeId, postIdNode));
                    }
                    return edges.iterator();
                });
                allEdgesRDD = allEdgesRDD.union(defaultEdges);
                System.out.println("DEBUG: Added default connections between " + countNeedy + " needy posts and " + allUsersSample.size() + " sample users.");
            } else {
                System.out.println("DEBUG: No federated or bluesky posts found needing default connections, or user sample is empty.");
            }
        } else {
            System.out.println("WARN: allUsersSample is empty. No default connections will be made for isolated federated/bluesky posts.");
        }
        
        // content based edges
        List<Tuple2<String, String>> contentBasedEdges = new ArrayList<>();
        
        // federated post content based edges
        List<Row> fedPostsContentData = federatedPostsData.select("source_site", "post_uuid_within_site", "post_text", "content_type").collectAsList();
        for (Row fedPostRow : fedPostsContentData) {
            String sourceSite = fedPostRow.getAs("source_site").toString();
            String postUuid = fedPostRow.getAs("post_uuid_within_site").toString();
            String postIdNode = "fp_" + sourceSite + "_" + postUuid;
            String text = fedPostRow.getAs("post_text") != null ? fedPostRow.getAs("post_text").toString().toLowerCase() : "";
            if (text.isEmpty()) text = fedPostRow.getAs("content_type") != null ? fedPostRow.getAs("content_type").toString().toLowerCase() : "";

            for (Row hashtagRow : collectedHashtags) {
                String hashtagName = hashtagRow.getAs("tag_text") != null ? hashtagRow.getAs("tag_text").toString().toLowerCase() : null;
                if (hashtagName != null && !hashtagName.isEmpty() && text.contains(hashtagName)) {
                    String hashtagIdNode = "h_" + hashtagRow.getAs("hashtag_id").toString();
                    contentBasedEdges.add(new Tuple2<>(postIdNode, hashtagIdNode));
                    contentBasedEdges.add(new Tuple2<>(hashtagIdNode, postIdNode));
                }
            }
        }

        // bluesky post content based edges
        Map<String, String> uriToBlueskyNodeIdMap = new HashMap<>();
        blueskyNodeIdToUri.collect().forEach(t -> uriToBlueskyNodeIdMap.put(t._2(), t._1()));

        List<Row> bsPostsTextData = blueskyPostsData.select("uri", "text").collectAsList(); 
        for (Row bsPostRow : bsPostsTextData) {
            String uri = bsPostRow.getAs("uri") != null ? bsPostRow.getAs("uri").toString() : null;
            if (uri == null || !uriToBlueskyNodeIdMap.containsKey(uri)) continue;
            String postIdNode = uriToBlueskyNodeIdMap.get(uri);
            String text = bsPostRow.getAs("text") != null ? bsPostRow.getAs("text").toString().toLowerCase() : "";

            for (Row hashtagRow : collectedHashtags) {
                String hashtagName = hashtagRow.getAs("tag_text") != null ? hashtagRow.getAs("tag_text").toString().toLowerCase() : null;
                if (hashtagName != null && !hashtagName.isEmpty() && text.contains(hashtagName)) {
                    String hashtagIdNode = "h_" + hashtagRow.getAs("hashtag_id").toString();
                    contentBasedEdges.add(new Tuple2<>(postIdNode, hashtagIdNode));
                    contentBasedEdges.add(new Tuple2<>(hashtagIdNode, postIdNode));
                }
            }
        }
        
        if (!contentBasedEdges.isEmpty()) {
            allEdgesRDD = allEdgesRDD.union(sc.parallelize(contentBasedEdges));
            System.out.println("Added " + contentBasedEdges.size()/2 + " unique content-based hashtag connections for federated/bluesky posts.");
        }
         
        allEdgesRDD = allEdgesRDD.distinct();
        JavaPairRDD<String, Iterable<String>> adjacencyList = JavaPairRDD.fromJavaRDD(allEdgesRDD).groupByKey().cache();
        System.out.println("Adjacency list created with " + adjacencyList.count() + " nodes.");

        // =adsorbption
        JavaPairRDD<String, Map<String, Double>> ranks = userNodes
            .mapToPair(userIdNode -> {
                Map<String, Double> initialWeight = new HashMap<>();
                initialWeight.put(userIdNode, 1.0);
                return new Tuple2<>(userIdNode, initialWeight);
            });
 
        int maxIterations = this.imax > 2 ? this.imax : 15;
 
        // adsorption iteration loop
        JavaPairRDD<String, Map<String, Double>> previousRanks = null;
        for (int iter = 0; iter < maxIterations; iter++) {
            System.out.println("Starting Adsorption Iteration: " + (iter + 1) + "/" + maxIterations);
            if(previousRanks != null) previousRanks.unpersist(false);
            previousRanks = ranks; 

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
 
                    if (neighborList.isEmpty()) return outgoingMessages.iterator();
 
                    long numNeighbors = neighborList.size();
                    long numHashtagNeighbors = neighborList.stream().filter(n -> n.startsWith("h_")).count();
                    long numPostNeighbors = neighborList.stream().filter(n -> n.startsWith("p_") || n.startsWith("fp_") || n.startsWith("bp_")).count();
                    long numUserNeighbors = neighborList.stream().filter(n -> n.startsWith("u_")).count();
 
                    for (String nodeI : neighborList) {
                        double weightJI = 0.0;
                        if (nodeJ.startsWith("u_")) {
                            if (nodeI.startsWith("h_") && numHashtagNeighbors > 0) weightJI = 0.3 / numHashtagNeighbors;
                            else if ((nodeI.startsWith("p_") || nodeI.startsWith("fp_") || nodeI.startsWith("bp_")) && numPostNeighbors > 0) weightJI = 0.4 / numPostNeighbors;
                            else if (nodeI.startsWith("u_") && numUserNeighbors > 0) weightJI = 0.3 / numUserNeighbors;
                        } else if (nodeJ.startsWith("h_")) {
                            if (numNeighbors > 0) weightJI = 1.0 / numNeighbors;
                        } else if (nodeJ.startsWith("p_") || nodeJ.startsWith("fp_") || nodeJ.startsWith("bp_")) {
                            if (numNeighbors > 0) weightJI = 1.0 / numNeighbors;
                        }
 
                       if (weightJI > 0) {
                            final double finalWeightJI = weightJI;
                            Map<String, Double> propagatedWeights = new HashMap<>();
                            weightsJ.forEach((user, weight) -> {
                                propagatedWeights.put(user, weight * finalWeightJI);
                            });
                            if (!propagatedWeights.isEmpty()) {
                                outgoingMessages.add(new Tuple2<>(nodeI, propagatedWeights));
                            }
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
        if(previousRanks != null) previousRanks.unpersist(false); 
 
        //filter for all node post ranks
            JavaPairRDD<String, Map<String, Double>> ranksFromAdsorption = ranks 
            .filter(t -> t._1.startsWith("p_") || t._1.startsWith("fp_") || t._1.startsWith("bp_"))
            .cache();

            System.out.println("Posts with calculated ranks from adsorption: Regular=" + ranksFromAdsorption.filter(t -> t._1.startsWith("p_")).count() + 
                        ", Federated=" + ranksFromAdsorption.filter(t -> t._1.startsWith("fp_")).count() + 
                        ", Bluesky=" + ranksFromAdsorption.filter(t -> t._1.startsWith("bp_")).count() +
                        ", Total=" + ranksFromAdsorption.count());

            // posts missing from adsorption
            JavaRDD<String> rankedPostNodeIdsFromAdsorption = ranksFromAdsorption.keys();
            JavaRDD<String> allPossiblePostNodesForGraph = regularPostNodes.union(federatedPostNodes).union(blueskyPostNodes).distinct();
            JavaRDD<String> missingPostNodes = allPossiblePostNodesForGraph.subtract(rankedPostNodeIdsFromAdsorption);
            long totalMissingCount = missingPostNodes.isEmpty() ? 0 : missingPostNodes.count();

            JavaPairRDD<String, Map<String, Double>> finalPostRanks; 

            if (totalMissingCount > 0) {
            System.out.println("WARNING: " + totalMissingCount + " posts have no ranking from adsorption, assigning default varied ranks.");
            JavaPairRDD<String, Map<String, Double>> defaultRanksForMissing = missingPostNodes
                .mapToPair(postIdNode -> {
                    Map<String, Double> userRanks = new HashMap<>();
                    if (!allUsersSample.isEmpty()) { 
                        for (String userIdPrefixed : allUsersSample) {
                            double baseRank = DECAY; 
                            int postHash = postIdNode.hashCode();
                            int userHash = userIdPrefixed.hashCode();
                            double variation = (Math.abs(postHash + userHash) % 1000) / 4000.0; 
                            userRanks.put(userIdPrefixed, baseRank + variation);
                        }
                    } else { 
                        System.out.println("WARN: allUsersSample is empty during default rank assignment for missing post: " + postIdNode);
                        userRanks.put("u_0", DECAY / 100.0); 
                    }
                    return new Tuple2<>(postIdNode, userRanks);
                });

            finalPostRanks = ranksFromAdsorption.union(defaultRanksForMissing);
            System.out.println("Added default rankings. Total posts with ranks before boost: " + finalPostRanks.count());
            } else {
            System.out.println("All connectable posts appear to have received rankings from adsorption.");
            finalPostRanks = ranksFromAdsorption;
            }
            if (totalMissingCount > 0) { 
            ranksFromAdsorption.unpersist(false);
            }

            System.out.println("DEBUG: Applying boost factor of " + BOOST_FACTOR_2Y2B + " to federated posts from '2y2b'.");

            final double localBoostFactor = this.BOOST_FACTOR_2Y2B; 

            JavaPairRDD<String, Map<String, Double>> ranksWithCustomBoost = finalPostRanks.mapToPair(pair -> {
            String nodeId = pair._1();
            Map<String, Double> userWeights = pair._2();
            Map<String, Double> boostedUserWeights = new HashMap<>();

            boolean boosted = false;
            if (nodeId.startsWith("fp_")) {
                String idPart = nodeId.substring(3);
                int firstUnderscore = idPart.indexOf('_');
                if (firstUnderscore > 0 && firstUnderscore < idPart.length() - 1) {
                    String sourceSite = idPart.substring(0, firstUnderscore);
                    if ("2y2b".equalsIgnoreCase(sourceSite)) {
                        for (Map.Entry<String, Double> entry : userWeights.entrySet()) {
                            boostedUserWeights.put(entry.getKey(), entry.getValue() * localBoostFactor);
                        }
                        boosted = true;
                    }
                }
            }

            return boosted ? new Tuple2<>(nodeId, boostedUserWeights) : new Tuple2<>(nodeId, userWeights);
            });

            JavaRDD<RankingData> rankingsToSave = ranksWithCustomBoost
            .flatMap(t -> {
                String nodeId = t._1; 
                Map<String, Double> userWeights = t._2;
                List<RankingData> results = new ArrayList<>();

                Map<String, Integer> fedOriginalIdLookup = federatedIdMapBroadcast.getValue();
                Map<String, String> bsNodeToUriLookup = blueskyNodeToUriBroadcast.getValue();

                for (Map.Entry<String, Double> entry : userWeights.entrySet()) {
                    String userIdPrefixed = entry.getKey();
                    if (!userIdPrefixed.startsWith("u_")) continue;
                    Integer numericUserId = Integer.parseInt(userIdPrefixed.substring(2)); 
                    Double rank = entry.getValue();

                    if (nodeId.startsWith("p_")) {
                        Integer numericPostId = Integer.parseInt(nodeId.substring(2));
                        results.add(new RankingData(numericPostId, numericUserId, rank));
                    } else if (nodeId.startsWith("fp_")) {
                        Integer originalFedTablePostId = fedOriginalIdLookup.get(nodeId);
                        if (originalFedTablePostId != null) {
                            String idPart = nodeId.substring(3);
                            int firstUnderscore = idPart.indexOf('_');
                            if (firstUnderscore > 0 && firstUnderscore < idPart.length() -1) {
                                String sourceSite = idPart.substring(0, firstUnderscore);
                                String postUuid = idPart.substring(firstUnderscore + 1);
                                results.add(new RankingData(originalFedTablePostId, sourceSite, postUuid, numericUserId, rank));
                            } else { System.err.println("WARN (RankingData): Malformed federated node ID: " + nodeId); }
                        } else { System.err.println("WARN (RankingData): No original table ID for federated node: " + nodeId); }
                    } else if (nodeId.startsWith("bp_")) {
                        String blueskyUri = bsNodeToUriLookup.get(nodeId);
                        if (blueskyUri != null) {
                            results.add(new RankingData(blueskyUri, numericUserId, rank));
                        } else { System.err.println("WARN (RankingData): No URI for Bluesky node: " + nodeId); }
                    }
                }
                return results.iterator();
            }).cache();

            if (finalPostRanks != ranksWithCustomBoost) {
            finalPostRanks.unpersist(false);
            }

        
        long countTotalSaved = rankingsToSave.count();
        long countRegularSaved = rankingsToSave.filter(r -> r.type == RankingData.Type.REGULAR).count();
        long countFederatedSaved = rankingsToSave.filter(r -> r.type == RankingData.Type.FEDERATED).count();
        long countBlueskySaved = rankingsToSave.filter(r -> r.type == RankingData.Type.BLUESKY).count();

        System.out.println("Preparing to save " + countTotalSaved + " ranking entries: " +
                           countRegularSaved + " regular, " +
                           countFederatedSaved + " federated, " +
                           countBlueskySaved + " Bluesky.");
         
        // save to db
        rankingsToSave.foreachPartition(iterator -> {
            String dbUrl = "jdbc:mysql://instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com:3306/instalite?rewriteBatchedStatements=true";
            Properties props = new Properties();
            props.setProperty("user", "nets2120project");
            props.setProperty("password", "nets2120project");
            props.setProperty("driver", "com.mysql.cj.jdbc.Driver");

            java.sql.Connection conn = null;
            java.sql.PreparedStatement pstmtRegular = null;
            java.sql.PreparedStatement pstmtFederated = null;
            java.sql.PreparedStatement pstmtBluesky = null;
            int batchSize = 1000;
            int currentRegularCount = 0;
            int currentFederatedCount = 0;
            int currentBlueskyCount = 0;

            try {
                conn = java.sql.DriverManager.getConnection(dbUrl, props);
                conn.setAutoCommit(false);

                String sqlRegular = "INSERT INTO post_rankings (post_id, user_id, rank_score, updated_at) " + 
                                    "VALUES (?, ?, ?, NOW()) " +
                                    "ON DUPLICATE KEY UPDATE rank_score = VALUES(rank_score), updated_at = NOW()";
                pstmtRegular = conn.prepareStatement(sqlRegular);

                String sqlFederated = "INSERT INTO post_rankings (post_id, user_id, rank_score, source_site, post_uuid_within_site, updated_at) " +
                                    "VALUES (?, ?, ?, ?, ?, NOW()) " +
                                    "ON DUPLICATE KEY UPDATE rank_score = VALUES(rank_score), updated_at = NOW()";
                pstmtFederated = conn.prepareStatement(sqlFederated);

                String sqlBluesky = "INSERT INTO post_rankings (post_id, user_id, rank_score, source_site, post_uuid_within_site, updated_at) " +
                                  "VALUES (NULL, ?, ?, 'bluesky', ?, NOW()) " + 
                                  "ON DUPLICATE KEY UPDATE rank_score = VALUES(rank_score), updated_at = NOW()";
                pstmtBluesky = conn.prepareStatement(sqlBluesky);

                while (iterator.hasNext()) {
                    RankingData record = iterator.next();
                    if (record.type == RankingData.Type.REGULAR) {
                        pstmtRegular.setInt(1, record.localRegularPostId);
                        pstmtRegular.setInt(2, record.userId);
                        pstmtRegular.setDouble(3, record.rankScore);
                        pstmtRegular.addBatch();
                        currentRegularCount++;
                    } else if (record.type == RankingData.Type.FEDERATED) {
                        pstmtFederated.setInt(1, record.localFederatedPostId);
                        pstmtFederated.setInt(2, record.userId);
                        pstmtFederated.setDouble(3, record.rankScore);
                        pstmtFederated.setString(4, record.sourceSiteForFederated);
                        pstmtFederated.setString(5, record.postUuidForFederated);
                        pstmtFederated.addBatch();
                        currentFederatedCount++;
                    } else if (record.type == RankingData.Type.BLUESKY) {
                        pstmtBluesky.setInt(1, record.userId);
                        pstmtBluesky.setDouble(2, record.rankScore);
                        pstmtBluesky.setString(3, record.blueskyPostUri);
                        pstmtBluesky.addBatch();
                        currentBlueskyCount++;
                    }

                    if (currentRegularCount > 0 && currentRegularCount % batchSize == 0) { pstmtRegular.executeBatch(); conn.commit(); currentRegularCount = 0; }
                    if (currentFederatedCount > 0 && currentFederatedCount % batchSize == 0) { pstmtFederated.executeBatch(); conn.commit(); currentFederatedCount = 0; }
                    if (currentBlueskyCount > 0 && currentBlueskyCount % batchSize == 0) { pstmtBluesky.executeBatch(); conn.commit(); currentBlueskyCount = 0; }
                }

                if (currentRegularCount > 0) pstmtRegular.executeBatch();
                if (currentFederatedCount > 0) pstmtFederated.executeBatch();
                if (currentBlueskyCount > 0) pstmtBluesky.executeBatch();
                conn.commit(); 

            } catch (Exception e) {
                System.err.println("Error saving rankings partition to DB: " + e.getMessage());
                e.printStackTrace();
                if (conn != null) { try { conn.rollback(); } catch (java.sql.SQLException se) { System.err.println("Rollback failed: " + se.getMessage());} }
                throw new RuntimeException("DB save failed in partition", e);
            } finally {
                if (pstmtRegular != null) try { pstmtRegular.close(); } catch (java.sql.SQLException se) { /* ignore */ }
                if (pstmtFederated != null) try { pstmtFederated.close(); } catch (java.sql.SQLException se) { /* ignore */ }
                if (pstmtBluesky != null) try { pstmtBluesky.close(); } catch (java.sql.SQLException se) { /* ignore */ }
                if (conn != null) try { conn.close(); } catch (java.sql.SQLException se) { /* ignore */ }
            }
        });
        
        System.out.println("Finished calculating and saving all post rankings.");
        spark.stop();
        return 1;
    }

    @Override
    public Integer call(JobContext arg0) throws Exception {
        return run(this.debug);
    }


    public static void main(String[] args) {
        System.out.println("Starting SocialRankJob directly (for local testing)...");
        try {
            String inputPath = args.length > 0 ? args[0] : "social_net_dummy.txt";
            double dmax = args.length > 1 ? Double.parseDouble(args[1]) : 30.0;
            int imax = args.length > 2 ? Integer.parseInt(args[2]) : 15;
            boolean debugFlag = args.length > 3 ? Boolean.parseBoolean(args[3]) : true; 
            int topN = args.length > 4 ? Integer.parseInt(args[4]) : 10; 

            Config config = new Config();
            Logger logger = LogManager.getLogger(SocialRankJob.class);
            FlexibleLogger flexLogger = new FlexibleLogger(logger, true, debugFlag); 
            
            SocialRankJob job = new SocialRankJob(inputPath, dmax, imax, topN, debugFlag, true, flexLogger );
            
            job.run(debugFlag);

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}