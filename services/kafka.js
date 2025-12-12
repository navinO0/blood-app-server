const { Kafka, Partitioners } = require('kafkajs');
const logger = require('../utils/logger');
const sendEmail = require('../utils/email');

const kafka = new Kafka({
  clientId: 'blood-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 3
  }
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});
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
    await consumer.subscribe({ topic: 'email-notifications', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const payload = JSON.parse(message.value.toString());
        logger.info(`Received Kafka message on ${topic}: ${JSON.stringify(payload)}`);
        
        // Handle Socket.IO Broadcast
        if (global.io) {
            if (topic === 'blood-requests') {
                global.io.emit('blood-request-notification', payload);
            } else if (topic === 'donation-offers') {
                global.io.emit('donation-accepted-notification', payload);
            }
        }

        // Handle Email Notifications
        if (topic === 'email-notifications') {
            try {
                const { to, template, templateVars } = payload;
                if (!to || !template) {
                    logger.error('Email notification missing required fields: to, template');
                    return;
                }
                
                await sendEmail({ to, template, templateVars });
                logger.info(`Email sent successfully via Kafka to: ${to}`);
            } catch (err) {
                logger.error(`Error processing email in Kafka consumer: ${err.message}`);
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
    logger.warn(`Kafka not connected. Falling back to direct socket emit for: ${topic}`);
    // Fallback: Direct Socket Emission
    if (global.io) {
        if (topic === 'blood-requests') {
            global.io.emit('blood-request-notification', message);
        } else if (topic === 'donation-offers') {
            global.io.emit('donation-accepted-notification', message);
        }
    }
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
    // Fallback on error too
    if (global.io) {
        if (topic === 'blood-requests') {
            global.io.emit('blood-request-notification', message);
        } else if (topic === 'donation-offers') {
            global.io.emit('donation-accepted-notification', message);
        }
    }
  }
};

module.exports = { connectKafka, sendEvent };
