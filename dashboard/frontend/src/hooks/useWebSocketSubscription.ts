import { useEffect, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  eventType?: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketSubscriptionOptions {
  events: string[];
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const useWebSocketSubscription = (options: UseWebSocketSubscriptionOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { events, onMessage, onError, onConnect, onDisconnect } = options;

  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: { events }
      }));
      
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'event' && message.eventType && events.includes(message.eventType)) {
          onMessage?.(message);
        }
      } catch (error) {
        
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    ws.onclose = () => {
      onDisconnect?.();
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [events.join(','), onMessage, onError, onConnect, onDisconnect]);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
};
