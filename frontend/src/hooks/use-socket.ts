"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('🔌 WebSocket connecté:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket déconnecté');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion WebSocket:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, isConnected };
}

// Hook pour écouter les événements de messages
export function useMessageEvents() {
  const { socket, isConnected } = useSocket();
  const [newMessage, setNewMessage] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      console.log('📨 Nouveau message reçu via WebSocket:', data);
      setNewMessage(data);
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket]);

  return { newMessage, isConnected };
}

// Hook pour écouter les événements de présence
export function useAttendanceEvents() {
  const { socket, isConnected } = useSocket();
  const [attendanceUpdate, setAttendanceUpdate] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    const handleAttendanceUpdate = (data: any) => {
      console.log('⏰ Mise à jour de présence reçue via WebSocket:', data);
      setAttendanceUpdate(data);
    };

    socket.on('attendance_update', handleAttendanceUpdate);

    return () => {
      socket.off('attendance_update', handleAttendanceUpdate);
    };
  }, [socket]);

  return { attendanceUpdate, isConnected };
}
