import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, MessageType, ChatConfiguration } from '../types';

export const useChatInterface = (config: ChatConfiguration) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Unified auto-scroll logic
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Unified message handling
  const handleSendMessage = useCallback(async (message: string, type?: MessageType) => {
    if (!message.trim() || config.disabled || !config.isConnected) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    if (config.onSendMessage) {
      await config.onSendMessage(message.trim(), type);
    }
  }, [config]);

  // Unified keyboard handling
  const handleKeyboardShortcut = useCallback((event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage(inputValue);
    }
    if (event.key === 'Escape' && isExpanded) {
      event.preventDefault();
      setIsExpanded(false);
    }
  }, [inputValue, handleSendMessage, isExpanded]);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isExpanded,
    setIsExpanded,
    messagesEndRef,
    scrollToBottom,
    handleSendMessage,
    handleKeyboardShortcut
  };
};

export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const windowWithSpeech = window as any;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = windowWithSpeech.webkitSpeechRecognition || windowWithSpeech.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    if (!recognitionRef.current) return;

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognitionRef.current.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    isSupported: !!recognitionRef.current,
    startListening,
    stopListening
  };
};