const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'blood-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 3
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'blood-app-group' });

let isKafkaConnected = false;

const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    isKafkaConnected = true;
    logger.info('Kafka Connected');
    
    await consumer.subscribe({ topic: 'blood-requests', fromBeginning: true });
    await consumer.subscribe({ topic: 'donation-offers', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const payload = JSON.parse(message.value.toString());
        logger.info(`Received Kafka message on ${topic}: ${JSON.stringify(payload)}`);
        
        if (global.io) {
            if (topic === 'blood-requests') {
                global.io.emit('blood-request-notification', payload);
            } else if (topic === 'donation-offers') {
                global.io.emit('donation-accepted-notification', payload);
            }
        }
      },
    });
  } catch (error) {
    logger.error(`Kafka Connection Failed: ${error.message}. Messaging features will be disabled.`);
    isKafkaConnected = false;
  }
};

const sendEvent = async (topic, message) => {
  if (!isKafkaConnected) {
    logger.warn(`Kafka not connected. Skipping event: ${topic}`);
    return;
  }
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    logger.info(`Sent Kafka message to ${topic}`);
  } catch (error) {
    logger.error(`Error sending Kafka message: ${error.message}`);
  }
};

module.exports = { connectKafka, sendEvent };
