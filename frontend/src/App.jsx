import {useState, useEffect, useRef} from "react"
import axios from "axios"

import './App.css'

// timestamps arrive as UTC; all display formatting happens here in local time
const pad = (n) => String(n).padStart(2, "0");

const fmtTime = (d) => {
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  return `${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())}${ampm}`;
};

// same day: just the time; older: date and time
const fmtMsgStamp = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? fmtTime(d) : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${fmtTime(d)}`;
};

const fmtHeaderDate = (iso) => {
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${d.toLocaleString("en-US", {month: "long"}).toLowerCase()} ${day}${suffix}, ${d.getFullYear()}`;
};

const GAP_MS = 15 * 60 * 1000;

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [userToken, setUserToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);
  const [sidebarMode, setSidebarMode] = useState("chats");
  const [chatList, setChatList] = useState([]);
  const [discoverList, setDiscoverList] = useState([]);
  const [newChatName, setNewChatName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [currentChat, setCurrentChat] = useState("");
  const [chatInfo, setChatInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [userList, setUserList] = useState([]);
  const [userSidebarVisible, setUserSidebarVisible] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const loadingOlder = useRef(false);
  const scrollAnchor = useRef(null);
  const fileInputRef = useRef(null);

  const chatWindowRef = useRef(null);
  const wsRef = useRef(null);
  const currentChatRef = useRef("");
  const usernameRef = useRef("");
  const lastTypingSent = useRef(0);
  const typingTimeouts = useRef({});

  const scrollToBottom = () => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  };

  const showErr = (err, fallback) => {
    setError(err?.response?.data?.error || fallback);
    setShowError(true);
  };

  const handleLogin = () => {
    if (loginUsername === "" || loginPassword === "") {
      setError("Username or password is empty");
      setShowError(true);
      return;
    }
    axios.post("/api/login", {username: loginUsername, password: loginPassword})
    .then((res) => {
      localStorage.setItem("token", res.data.token);
      setLoggedIn(true);
      setUserToken(res.data.token);
    })
    .catch((err) => showErr(err, "Unable to login"));
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUserToken(null);
    setUsername("");
    usernameRef.current = "";
    setChatList([]);
    closeChat();
    getDiscoverable();
  }

  const handleRegister = () => {
    if (loginUsername === "" || loginPassword === "") {
      setError("Username or password is empty");
      setShowError(true);
      return;
    }
    axios.post("/api/register", {username: loginUsername, password: loginPassword})
    .then((res) => {
      localStorage.setItem("token", res.data.token);
      setLoggedIn(true);
      setUsername(loginUsername);
      setUserToken(res.data.token);
    })
    .catch((err) => showErr(err, "Unable to register"));
  }

  const getChats = () => {
    api.get("/chats")
    .then((res) => setChatList(res.data))
    .catch((err) => showErr(err, "Unable to get chats"));
  }

  const getDiscoverable = () => {
    api.get("/chats/discoverable")
    .then((res) => setDiscoverList(res.data))
    .catch((err) => showErr(err, "Unable to get chats"));
  }

  const getUsers = () => {
    api.get("/users")
    .then((res) => setUserList(res.data))
    .catch(() => {});
  }

  const handleChatCreate = () => {
    if (newChatName === "") {
      setError("new chat name is empty");
      setShowError(true);
      return;
    }
    api.post("/chats", {name: newChatName})
    .then((res) => {
      setNewChatName("");
      getChats();
      switchChat(res.data.chat.id);
    })
    .catch((err) => showErr(err, "Unable to create chat"));
  }

  const switchChat = (chatId) => {
    api.get(`/chats/${chatId}`)
    .then((res) => {
      setCurrentChat(chatId);
      currentChatRef.current = chatId;
      setChatInfo(res.data);
      setTypingUsers([]);
      api.get(`/chats/${chatId}/messages`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMore(res.data.has_more);
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch((err) => showErr(err, "Unable to get messages"));
    })
    .catch((err) => showErr(err, "Unable to get chat"));
  }

  // refresh chat info (role, members) without reloading messages
  const refreshChatInfo = (chatId) => {
    api.get(`/chats/${chatId}`)
    .then((res) => setChatInfo(res.data))
    .catch(() => {});
  }

  const refreshChat = () => {
    if (currentChat) refreshChatInfo(currentChat);
  }

  const closeChat = () => {
    setCurrentChat("");
    currentChatRef.current = "";
    setChatInfo(null);
    setMessages([]);
    setTypingUsers([]);
  }

  const handleChatDelete = () => {
    api.delete(`/chats/${currentChat}`)
    .then(() => {
      closeChat();
      getChats();
    })
    .catch((err) => showErr(err, "Unable to delete chat"));
  }

  const handleLeave = () => {
    api.post(`/chats/${currentChat}/leave`)
    .then(() => {
      closeChat();
      getChats();
    })
    .catch((err) => showErr(err, "Unable to leave chat"));
  }

  const handleJoinByCode = () => {
    if (!loggedIn) {
      setError("log in to join chats");
      setShowError(true);
      return;
    }
    if (inviteCodeInput.trim() === "") {
      setError("invite code is empty");
      setShowError(true);
      return;
    }
    api.post("/chats/join", {invite_code: inviteCodeInput.trim()})
    .then((res) => {
      setInviteCodeInput("");
      getChats();
      setSidebarMode("chats");
      switchChat(res.data.chat.id);
    })
    .catch((err) => showErr(err, "Unable to join chat"));
  }

  const handleJoinPublic = (chatId) => {
    api.post(`/chats/${chatId}/join`)
    .then(() => {
      getChats();
      getDiscoverable();
      switchChat(chatId);
    })
    .catch((err) => showErr(err, "Unable to join chat"));
  }

  const handleToggleDiscoverable = () => {
    api.patch(`/chats/${currentChat}`, {discoverable: !chatInfo.discoverable})
    .then(() => refreshChat())
    .catch((err) => showErr(err, "Unable to update chat"));
  }

  const handleKick = (member) => {
    api.delete(`/chats/${currentChat}/members/${member}`)
    .then(() => refreshChat())
    .catch((err) => showErr(err, "Unable to remove user"));
  }

  const handleDeleteMessage = (messageId) => {
    api.delete(`/chats/${currentChat}/messages/${messageId}`)
    .then(() => {
      setMessages(messages.filter((m) => m.id !== messageId));
    })
    .catch((err) => showErr(err, "Unable to delete message"));
  }

  const sendMessage = () => {
    if (!messageInput.trim() || !currentChat) {
      return;
    }
    api.post(`/chats/${currentChat}/messages`, {message: messageInput.trim()})
    .then((res) => {
      setMessageInput("");
      appendMessage(res.data.data);
    })
    .catch((err) => showErr(err, "Unable to send message"));
  };

  // dedup by id: a message can arrive via both POST response and websocket
  const appendMessage = (msg) => {
    setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    // only autoscroll if the user is near the bottom
    const el = chatWindowRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  // load older messages when scrolled to the top, preserving scroll position
  const loadOlderMessages = () => {
    const el = chatWindowRef.current;
    if (!el || loadingOlder.current || !hasMore || messages.length === 0) return;
    loadingOlder.current = true;
    const chatId = currentChatRef.current;
    const prevHeight = el.scrollHeight;
    api.get(`/chats/${chatId}/messages`, {params: {before: messages[0].timestamp}})
    .then((res) => {
      if (currentChatRef.current !== chatId) { loadingOlder.current = false; return; }
      scrollAnchor.current = { prevHeight };
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMore(res.data.has_more);
    })
    .catch(() => { loadingOlder.current = false; });
  };

  // after older messages render, restore the viewport to the message the user was on
  useEffect(() => {
    if (scrollAnchor.current && chatWindowRef.current) {
      const el = chatWindowRef.current;
      el.scrollTop = el.scrollHeight - scrollAnchor.current.prevHeight;
      scrollAnchor.current = null;
      loadingOlder.current = false;
    }
  }, [messages]);

  const handleChatScroll = () => {
    const el = chatWindowRef.current;
    if (el && el.scrollTop < 40) {
      loadOlderMessages();
    }
  };

  const sendImage = (file) => {
    if (!file || !currentChat) return;
    if (!file.type.startsWith("image/")) {
      setError("only image files can be uploaded");
      setShowError(true);
      return;
    }
    if (file.size >= 1024 * 1024) {
      setError("image too large (max 1MB)");
      setShowError(true);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    api.post(`/chats/${currentChat}/images`, form)
    .then((res) => appendMessage(res.data.data))
    .catch((err) => showErr(err, "Unable to send image"));
  };

  const handleRegenerateInvite = () => {
    api.post(`/chats/${currentChat}/invite`)
    .then((res) => setChatInfo((prev) => ({...prev, invite_code: res.data.invite_code})))
    .catch((err) => showErr(err, "Unable to regenerate invite code"));
  };

  const sendTyping = () => {
    const socket = wsRef.current;
    const now = Date.now();
    if (socket?.readyState === WebSocket.OPEN && currentChatRef.current && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      socket.send(JSON.stringify({type: "typing", chatId: currentChatRef.current}));
    }
  };

  const handleWsEvent = (event) => {
    switch (event.type) {
      case "presence:init":
        setOnlineUsers(event.online);
        break;
      case "presence":
        setOnlineUsers((prev) => event.online ? [...new Set([...prev, event.username])] : prev.filter((u) => u !== event.username));
        break;
      case "message:new":
        if (event.chatId === currentChatRef.current) {
          appendMessage(event.message);
          setTypingUsers((prev) => prev.filter((u) => u !== event.message.sender_name));
        }
        break;
      case "message:deleted":
        if (event.chatId === currentChatRef.current) {
          setMessages((prev) => prev.filter((m) => m.id !== event.messageId));
        }
        break;
      case "typing":
        if (event.chatId === currentChatRef.current && event.username !== usernameRef.current) {
          setTypingUsers((prev) => prev.includes(event.username) ? prev : [...prev, event.username]);
          clearTimeout(typingTimeouts.current[event.username]);
          typingTimeouts.current[event.username] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u !== event.username));
          }, 3000);
        }
        break;
      case "chat:members":
        if (event.chatId === currentChatRef.current) {
          refreshChatInfo(event.chatId);
        }
        break;
      case "kicked":
        getChats();
        if (event.chatId === currentChatRef.current) {
          closeChat();
          setError("you were removed from the chat");
          setShowError(true);
        }
        break;
      case "chat:deleted":
        getChats();
        if (event.chatId === currentChatRef.current) {
          closeChat();
        }
        break;
      default:
        break;
    }
  };

  const wsHandlerRef = useRef(handleWsEvent);
  useEffect(() => {
    wsHandlerRef.current = handleWsEvent;
  });

  useEffect(() => {
    if (!userToken) return;
    let socket;
    let retryTimer;
    let closed = false;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${window.location.host}/api/ws?token=${userToken}`);
      wsRef.current = socket;
      socket.onmessage = (e) => {
        try {
          wsHandlerRef.current(JSON.parse(e.data));
        } catch { /* ignore malformed events */ }
      };
      socket.onclose = () => {
        setOnlineUsers([]);
        if (!closed) {
          retryTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      wsRef.current = null;
      socket?.close();
    };
  }, [userToken]);

  useEffect(() => {
    getUsers();
    getDiscoverable();
  }, []);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    if (userToken) {
      api.get("/user")
      .then((res) => {
        setLoggedIn(true);
        setUsername(res.data.name);
        getChats();
        getDiscoverable();
      })
      .catch(() => {
        localStorage.removeItem("token");
        setLoggedIn(false);
        setUserToken(null);
      })
    }
    else {
      setLoggedIn(false);
    }
  }, [userToken]);


  const isAdmin = chatInfo?.role === "admin";
  const isMember = chatInfo?.role != null;

  return (
    <>
    <div id="container">
      <div id="header">
        <div id="logo">
          <h1>chat</h1>
        </div>

        {showError ? (
        <div id="error">
          <div id="error_text">
            <p>error: {error}</p>
          </div>
          <div>
            <button id="error_button" onClick={() => {setShowError(false)}}>clear</button>
          </div>
        </div>
        ) : (
          <></>
        )}
        <div id="header_controls">
          <button id="sidebar_toggle" onClick={() => setSidebarVisible(!sidebarVisible)}>
            {sidebarVisible ? "hide chats" : "show chats"}
          </button>
          <button id="user_sidebar_toggle" onClick={() => setUserSidebarVisible(!userSidebarVisible)}>
            {userSidebarVisible ? "hide users" : "show users"}
          </button>
        </div>
      </div>
      <div id="content">
        {sidebarVisible && (
          <div id="sidebar">
            <div id="sidebar_mode">
              <button disabled={sidebarMode === "chats"} onClick={() => setSidebarMode("chats")}>my chats</button>
              <button disabled={sidebarMode === "join"} onClick={() => {setSidebarMode("join"); getDiscoverable();}}>join</button>
            </div>
            {sidebarMode === "chats" ? (
              <>
                <div id="new_chat">
                  <div id="new_chat_input">
                    <input placeholder="chat name" value={newChatName} onChange={(e) => setNewChatName(e.target.value)}></input>
                  </div>
                  <div id="new_chat_button">
                    <button onClick={handleChatCreate}>create</button>
                  </div>
                </div>
                <div id="chats_container">
                  <div id="chats">
                    {!loggedIn ? (
                      <p>log in to see your chats</p>
                    ) : chatList.length === 0 ? (
                      <p>no chats yet. create one or join!</p>
                    ) : (
                      chatList.map((chat) => (
                        <div className="chat_item" key={chat.id}>
                          <p>
                            <a href="" onClick={(e)=>{e.preventDefault();switchChat(chat.id)}}>
                              {currentChat === chat.id ? <b>#{chat.name}</b> : <>#{chat.name}</>}
                            </a>
                            {chat.role === "admin" ? <span> *</span> : null}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div id="new_chat">
                  <div id="new_chat_input">
                    <input placeholder="invite code" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)}></input>
                  </div>
                  <div id="new_chat_button">
                    <button onClick={handleJoinByCode}>join</button>
                  </div>
                </div>
                <div id="chats_container">
                  <div id="chats">
                    {discoverList.length === 0 ? (
                      <p>no public chats found...</p>
                    ) : (
                      discoverList.map((chat) => (
                        <div className="chat_item" key={chat.id}>
                          <p>
                            <a href="" onClick={(e)=>{e.preventDefault();switchChat(chat.id)}}>#{chat.name}</a>
                            {" "}
                            {chat.joined ? (
                              <span>(joined)</span>
                            ) : loggedIn ? (
                              <a href="" onClick={(e)=>{e.preventDefault();handleJoinPublic(chat.id)}}>[join]</a>
                            ) : null}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            {loggedIn ? (
              <div id="user_container">
                <div id="username">
                  <h3>{username}</h3>
                </div>
                <div id="logout">
                  <button onClick={handleLogout}>logout</button>
                </div>
              </div>
            ) : (
              <div id="login">
                <div id="login_inputs">
                  <input placeholder="username" onChange={(e) => {setLoginUsername(e.target.value)}}></input>
                  <input placeholder="password" type="password" onChange={(e) => {setLoginPassword(e.target.value)}}></input>
                </div>
                <div id="login_buttons">
                  <button onClick={handleRegister}>register</button>
                  <button onClick={handleLogin}>login</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div id="chatbox">
            {currentChat && chatInfo ? (
              <>
                <div id="chat_header">
                  <div id="chat_name">
                    <h3>{chatInfo.name}</h3>
                  </div>
                  <div id="chat_options">
                    {isAdmin ? (
                      <>
                        <span className="chat_option">invite code: <b>{chatInfo.invite_code}</b></span>
                        <button className="chat_option" onClick={handleRegenerateInvite}>regenerate</button>
                        <label className="chat_option">
                          <input type="checkbox" checked={chatInfo.discoverable} onChange={handleToggleDiscoverable} />
                          public
                        </label>
                        <button onClick={handleChatDelete}>delete chat</button>
                      </>
                    ) : (
                      <>
                        <span className="chat_option">by: <b>{chatInfo.author}</b></span>
                        {isMember ? (
                          <button onClick={handleLeave}>leave</button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
              </>
            )}
            <div id="chat_window" ref={chatWindowRef} onScroll={handleChatScroll}>
              {currentChat && hasMore ? (
                <p><a href="" onClick={(e)=>{e.preventDefault();loadOlderMessages()}}>[load older messages]</a></p>
              ) : null}
              {currentChat ? (
                messages.length > 0 ? (
                  messages.map((msg, idx) => (
                    <div key={msg.id}>
                      {idx > 0 && new Date(msg.timestamp) - new Date(messages[idx - 1].timestamp) > GAP_MS ? (
                        <p className="date_header">{fmtHeaderDate(msg.timestamp)}</p>
                      ) : null}
                      <p>
                        <span className="msg_time" title={new Date(msg.timestamp).toLocaleString()}>{fmtMsgStamp(msg.timestamp)}</span>{" "}
                        <span><b>{msg.sender_name}:</b></span>{" "}
                        {msg.data?.image ? (
                          <img className="chat_image" src={msg.data.image} alt="uploaded image" />
                        ) : (
                          msg.message
                        )}
                        {isAdmin ? (
                          <>
                            {" "}
                            <a href="" className="msg_delete" onClick={(e)=>{e.preventDefault();handleDeleteMessage(msg.id)}}>[x]</a>
                          </>
                        ) : null}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>no messages yet...</p>
                )
              ) : null}
            </div>
            {currentChat && typingUsers.length > 0 ? (
              <div id="typing">
                <p>{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</p>
              </div>
            ) : null}
            {currentChat && chatInfo ? (
              isMember ? (
                <div id="chat_input">
                  <input
                    type="text"
                    placeholder="send message"
                    value={messageInput}
                    onChange={(e) => {setMessageInput(e.target.value); sendTyping();}}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sendMessage();
                      }
                    }}
                  />
                  <button onClick={sendMessage}>send</button>
                  <button id="image_button" title="send image (max 1MB)" onClick={() => fileInputRef.current?.click()}>
                    <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 462.54"><path fillRule="nonzero" d="M49.68 0h337.29c13.65 0 26.06 5.64 35.03 14.61l.83.91c8.53 8.94 13.81 21.05 13.81 34.17V192.3c-13.83-3.96-28.43-6.1-43.53-6.1-7.25 0-14.38.5-21.37 1.45l38.17-35.52V49.69c0-5.95-2.36-11.49-6.2-15.62l-.6-.56c-4.16-4.16-9.89-6.79-16.14-6.79H49.68c-6.05 0-11.55 2.35-15.62 6.14l-.58.62c-4.16 4.16-6.76 9.91-6.76 16.21v177.93c29.58-26.67 76.93-63.95 106.82-89.08 4.88-4.22 12.14-4.13 16.93-.04.97.81 1.69 1.79 2.5 2.75l69.64 105.62 24.89-75.76c1.99-10.58 14.49-14.09 22.06-7.06l45.01 43.1c-7.78 4.48-15.12 9.62-21.99 15.32l-23.17-22.24-25.4 78.78c-1.6 11.15-15.44 15.38-22.92 6.78l-80.27-118.34-114.1 95.68v79.68c0 6.26 2.63 11.99 6.79 16.15 4.19 4.2 9.96 6.82 16.17 6.82h187.54c1.29 9.18 3.37 18.11 6.18 26.72H49.68c-13.58 0-26.04-5.62-35.07-14.64C5.64 368.88 0 356.46 0 342.81V49.69c0-13.67 5.59-26.11 14.58-35.11l.92-.83C24.45 5.25 36.49 0 49.68 0zm343.43 224.75c32.83 0 62.56 13.31 84.06 34.82 21.52 21.52 34.83 51.24 34.83 84.07 0 32.83-13.31 62.57-34.82 84.07-21.51 21.52-51.24 34.83-84.07 34.83-32.82 0-62.55-13.31-84.07-34.83-21.51-21.5-34.82-51.24-34.82-84.07 0-32.8 13.31-62.5 34.82-84.02 21.57-21.56 51.27-34.87 84.07-34.87zm-8.57 66.1h17.16c4.06 0 7.39 3.37 7.39 7.38v29.46h29.44c4.06 0 7.39 3.4 7.39 7.39v17.15c0 4.02-3.37 7.4-7.39 7.4h-29.44v29.44c0 4.02-3.37 7.39-7.39 7.39h-17.16c-4.02 0-7.39-3.32-7.39-7.39v-29.44h-29.47c-4.02 0-7.39-3.33-7.39-7.4v-17.15c0-4.07 3.32-7.39 7.39-7.39h29.47v-29.46c0-4.06 3.32-7.38 7.39-7.38zm76.4-15.05c-17.34-17.34-41.34-28.09-67.83-28.09-26.5 0-50.5 10.73-67.86 28.07-17.34 17.35-28.07 41.36-28.07 67.86 0 26.49 10.75 50.5 28.09 67.84 17.36 17.36 41.36 28.1 67.84 28.1 26.49 0 50.49-10.74 67.84-28.1 17.35-17.34 28.09-41.35 28.09-67.84 0-26.48-10.74-50.48-28.1-67.84zM267.9 61.14c11.04 0 21.06 4.48 28.31 11.73s11.73 17.26 11.73 28.31c0 11.03-4.48 21.06-11.73 28.31s-17.27 11.73-28.31 11.73c-11.05 0-21.06-4.48-28.31-11.73s-11.73-17.28-11.73-28.31c0-11.05 4.48-21.06 11.73-28.31s17.26-11.73 28.31-11.73zm12.22 27.82a17.281 17.281 0 0 0-12.22-5.05c-4.77 0-9.1 1.94-12.22 5.05a17.272 17.272 0 0 0-5.04 12.22c0 4.77 1.93 9.1 5.04 12.22 3.12 3.11 7.45 5.05 12.22 5.05 4.77 0 9.1-1.94 12.22-5.05 3.11-3.12 5.05-7.45 5.05-12.22 0-4.77-1.94-9.1-5.05-12.22z"/></svg>
                  </button>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{display: "none"}} ref={fileInputRef}
                    onChange={(e) => {sendImage(e.target.files[0]); e.target.value = "";}} />
                </div>
              ) : (
                <div id="chat_input">
                  {loggedIn ? (
                    <button className="join_button" onClick={() => handleJoinPublic(currentChat)}>join chat to send messages</button>
                  ) : (
                    <button className="join_button" onClick={() => {setError("log in to join chats"); setShowError(true);}}>log in to send messages</button>
                  )}
                </div>
              )
            ) : null}
        </div>
        {userSidebarVisible && (
          <div id="users_container">
            <div id="users_header">
              <div id="users_text">
                <h3>{currentChat && chatInfo ? "members" : "users"}</h3>
              </div>
            </div>
            <div id="users">
              {currentChat && chatInfo ? (
                chatInfo.members.map((member) => (
                  <div key={member.user_name} className="user">
                    <p>
                      <span className={onlineUsers.includes(member.user_name) ? "online" : "offline"}>●</span>
                      {" "}{member.user_name}
                      {member.role === "admin" ? <span> *</span> : null}
                      {isAdmin && member.role !== "admin" ? (
                        <>
                          {" "}
                          <a href="" onClick={(e)=>{e.preventDefault();handleKick(member.user_name)}}>[kick]</a>
                        </>
                      ) : null}
                    </p>
                  </div>
                ))
              ) : (
                userList.map((user, idx) => (
                  <div key={user.name || idx} className="user">
                    <p>
                      <span className={onlineUsers.includes(user.name) ? "online" : "offline"}>●</span>
                      {" "}{user.name}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default App
