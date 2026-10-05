'use client';
import React, { createContext, useState, useEffect } from 'react';
import socket, { initSocket } from '../utils/socket';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';

const SocketContext = createContext(null);

const SocketProvider = ({ children }) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const authenticatedTenantRef = React.useRef(null);

  useEffect(() => {
    if (!socket) return;
    initSocket();

    const handleConnect = () => {
      const user = getUserDetailsInLocalStorage();
      if (user?.tenant_id && authenticatedTenantRef.current !== user.tenant_id) {
        authenticatedTenantRef.current = user.tenant_id;
        socket.emit("authenticate", user.tenant_id);
      }
      setIsSocketConnected(true);
    };

    const handleDisconnect = () => {
      authenticatedTenantRef.current = null;
      setIsSocketConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isSocketConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext, SocketProvider };
