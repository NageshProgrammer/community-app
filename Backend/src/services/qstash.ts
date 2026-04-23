import { Client, Receiver } from "@upstash/qstash";
import dotenv from "dotenv";

dotenv.config();

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

export const publishToQueue = async (data: any) => {
  // We publish to the worker endpoint on our own server
  // QStash will then call us back at that URL
  const destination = process.env.WORKER_URL || `${process.env.BACKEND_URL}/api/worker/process-activity`;
  
  try {
    const res = await qstashClient.publishJSON({
      url: destination,
      body: data,
    });
    return res;
  } catch (err) {
    console.error("❌ QStash Publish Error:", err);
    throw err;
  }
};
