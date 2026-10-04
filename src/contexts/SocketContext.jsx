'use client';
import React, { createContext, useState, useEffect } from 'react';
import socket, { initSocket } from '../utils/socket';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';

const SocketContext = createContext(null);

const SocketProvider = ({ children }) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    if (!socket) return;
    initSocket();

    const handleConnect = () => {
      const user = getUserDetailsInLocalStorage();
      if(user) {
        socket.emit("authenticate", user.tenant_id);
      }
      setIsSocketConnected(true);
    };

    const handleDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isSocketConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext, SocketProvider };
