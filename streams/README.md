# Setting up Your Kafka Client

For your Project, you will be connecting to an EC2 server running Kafka.  From here, you will be able to subscribe as a Producer and a Consumer to *topics* (publish/subscribe channels).

From your Project Description you'll know that you'll use a topic for reading Twitter messages (this will include messages Published by us from the Twitter APIs), and for sending/receiving inter-project chat messages.

## Connecting to the Kafka server

Like many other services, you will need to set up a *tunnel* to talk to Kafka.  First, we'll need to actually make a modification to a file in your Docker container.  This modification will let your Docker container redirect requests that normally would go *inside* Amazon's cloud network to your tunnel.

Go to the Terminal in your Docker container via VSCode.  Then open a terminal.

```bash
nvm use 22.13.1
npm install
```

Next you can create the tunnel, much as you've done in the past:

```ssh -i ~/nets2120/nets2120_tunnel -4 -L 9092:localhost:9092 sshtunnel@ec2-18-218-240-208.us-east-2.compute.amazonaws.com

```

where we provide `nets2120_tunnel` on Ed.

As per prior cases, leave this running. You can exit to log out and shut down the tunnel.


### Kafka Client for Javascript

Now you can write code using the Javascript client for Kafka, [KafkaJS](https://kafka.js.org/).  You should look both at how to write a consumer (used for Twitter) and a producer (used for inter-project chat).

We've provided a sample [app.js](app.js) and [package.json](package.json) that you should be able to use via `npm run start`.  These use configuration info from `config.json`; you might want to adapt them to your purposes.  Note that you should uniquely name your groupId or else you likely won't see any new messages.

