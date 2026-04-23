import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'community-app',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  connectionTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 0
  },
  logCreator: () => () => {} // Completely silence Kafka logs
});

let producer: Producer;
let consumer: Consumer;
let isKafkaEnabled = process.env.USE_KAFKA === 'true';

export const getProducer = async () => {
  if (!isKafkaEnabled) return null;
  if (!producer) {
    try {
      producer = kafka.producer({ retry: { retries: 2 } });
      await producer.connect();
      console.log('✅ Kafka Producer Connected');
    } catch (err) {
      console.warn('⚠️ Kafka Producer failed to connect, falling back to Redis');
      isKafkaEnabled = false;
      return null;
    }
  }
  return producer;
};

export const getConsumer = async (groupId: string) => {
  if (!isKafkaEnabled) return null;
  if (!consumer) {
    try {
      consumer = kafka.consumer({ groupId, retry: { retries: 2 } });
      await consumer.connect();
      console.log('✅ Kafka Consumer Connected');
    } catch (err) {
      console.warn('⚠️ Kafka Consumer failed to connect');
      isKafkaEnabled = false;
      return null;
    }
  }
  return consumer;
};

export const isKafkaAvailable = () => isKafkaEnabled;

export const TOPICS = {
  ACTIVITIES: 'community.activities',
  NOTIFICATIONS: 'community.notifications',
};

export const emitActivity = async (userId: string, type: string, payload: any) => {
  try {
    const p = await getProducer();
    if (!p) return; 
    await p.send({
      topic: TOPICS.ACTIVITIES,
      messages: [
        {
          key: userId,
          value: JSON.stringify({ userId, type, payload, timestamp: Date.now() }),
        },
      ],
    });
  } catch (error) {
    console.error('Kafka Produce Error:', error);
  }
};
