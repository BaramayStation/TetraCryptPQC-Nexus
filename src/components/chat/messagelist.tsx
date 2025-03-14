import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { decryptAES, verifyZKProof } from "@/lib/crypto";
import { Provider, Contract } from "starknet";
import { getUserProfile } from "@/lib/storage";

// ✅ Constants for Web3 Messaging
const STARKNET_MESSAGING_CONTRACT = "0xYourStarkNetMessagingContractAddress";
const WEBSOCKET_URL = "wss://starknet.io/events";

interface Message {
  sender: string;
  content: string;
  timestamp: number;
}

const MessageList: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const user = getUserProfile();
  const messagesRef = useRef<Message[]>([]); // Prevents stale state issues

  // ✅ Fetch Messages from StarkNet (With Async Decryption)
  const fetchMessages = async () => {
    setLoading(true);

    try {
      const provider = new Provider({ rpc: { nodeUrl: "https://starknet-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID" } });
      const messagingContract = new Contract(
        [
          {
            name: "get_message",
            type: "function",
            inputs: [
              { name: "sender", type: "felt" },
              { name: "receiver", type: "felt" },
            ],
            outputs: [{ name: "encrypted_content", type: "felt" }],
          },
        ],
        STARKNET_MESSAGING_CONTRACT,
        provider
      );

      const response = await messagingContract.call("get_message", [
        user.starknetAddress,
        "0xReceiverAddress", // Change dynamically based on chat partner
      ]);

      const encryptedContent = response.encrypted_content;

      if (!(await verifyZKProof(encryptedContent))) {
        console.warn("❌ Invalid zk-STARK proof. Ignoring message.");
        return;
      }

      const decryptedMessage = await decryptAES(encryptedContent, user.sessionKey);

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, { sender: "You", content: decryptedMessage, timestamp: Date.now() }];
        messagesRef.current = updatedMessages; // Keep ref updated
        return updatedMessages;
      });
    } catch (error) {
      console.error("❌ Failed to retrieve messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ WebSocket Real-Time Updates with Auto-Reconnect & Async Handling
  useEffect(() => {
    if (!user) return;

    const connectWebSocket = () => {
      const websocket = new WebSocket(WEBSOCKET_URL);

      websocket.onopen = () => {
        console.log("🔹 WebSocket Connected");
        websocket.send(JSON.stringify({ contract_address: STARKNET_MESSAGING_CONTRACT, event: "MessageSent" }));
      };

      websocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === "MessageSent") {
            if (messagesRef.current.some((msg) => msg.content === data.encrypted_content)) {
              console.warn("⚠️ Duplicate message detected. Skipping.");
              return;
            }

            if (!(await verifyZKProof(data.encrypted_content))) {
              console.warn("❌ Invalid zk-STARK proof detected. Ignoring message.");
              return;
            }

            const decryptedContent = await decryptAES(data.encrypted_content, user.sessionKey);

            setMessages((prevMessages) => {
              const updatedMessages = [
                ...prevMessages,
                { sender: data.sender, content: decryptedContent, timestamp: Date.now() },
              ];
              messagesRef.current = updatedMessages;
              return updatedMessages;
            });
          }
        } catch (error) {
          console.error("❌ Error processing WebSocket message:", error);
        }
      };

      websocket.onclose = () => {
        console.log("🔴 WebSocket Disconnected. Reconnecting in 3s...");
        setTimeout(connectWebSocket, 3000);
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
    };
  }, [user]);

  return (
    <div className="p-4 border rounded-lg shadow-lg bg-gray-900 text-white">
      <h2 className="text-xl font-semibold">📩 Secure Messages</h2>

      {loading && <p className="text-gray-400">🔄 Loading messages...</p>}

      <div className="mt-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-400">No messages yet.</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="p-3 rounded-lg bg-gray-800">
              <span className="font-bold">{msg.sender}:</span> {msg.content}
              <p className="text-xs text-gray-400">
                📅 {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      <Button onClick={fetchMessages} className="mt-4 bg-blue-600 hover:bg-blue-700">
        🔄 Refresh Messages
      </Button>
    </div>
  );
};

export default MessageList;