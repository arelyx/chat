import {useState, useEffect, useRef} from "react"
import axios from "axios"

import './App.css'

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
  const [addMemberInput, setAddMemberInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const loadingOlder = useRef(false);
  const scrollAnchor = useRef(null);
  const [emotes, setEmotes] = useState([]);
  const [showEmotes, setShowEmotes] = useState(false);
  const [newEmoteName, setNewEmoteName] = useState("");
  const fileInputRef = useRef(null);
  const emoteFileRef = useRef(null);

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
      getEmotes(chatId);
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
    setEmotes([]);
    setShowEmotes(false);
  }

  const getEmotes = (chatId) => {
    api.get(`/chats/${chatId}/emotes`)
    .then((res) => setEmotes(res.data))
    .catch(() => setEmotes([]));
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

  const handleAddMember = () => {
    if (addMemberInput.trim() === "") return;
    api.post(`/chats/${currentChat}/members`, {username: addMemberInput.trim()})
    .then(() => {
      setAddMemberInput("");
      refreshChat();
    })
    .catch((err) => showErr(err, "Unable to add user"));
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

  const handleAddEmote = (file) => {
    if (!file || !currentChat) return;
    if (!newEmoteName.trim()) {
      setError("emote name is empty");
      setShowError(true);
      return;
    }
    if (file.size >= 1024 * 1024) {
      setError("image too large (max 1MB)");
      setShowError(true);
      return;
    }
    const form = new FormData();
    form.append("name", newEmoteName.trim());
    form.append("file", file);
    api.post(`/chats/${currentChat}/emotes`, form)
    .then(() => {
      setNewEmoteName("");
      getEmotes(currentChat);
    })
    .catch((err) => showErr(err, "Unable to add emote"));
  };

  const handleDeleteEmote = (name) => {
    api.delete(`/chats/${currentChat}/emotes/${name}`)
    .then(() => getEmotes(currentChat))
    .catch((err) => showErr(err, "Unable to delete emote"));
  };

  // message text with :name: tokens swapped for emote images
  const renderMessageText = (text) => {
    if (!text) return text;
    const parts = text.split(/(:[a-zA-Z0-9_]+:)/g);
    if (parts.length === 1) return text;
    const emoteMap = Object.fromEntries(emotes.map((e) => [e.name, e.url]));
    return parts.map((part, i) => {
      const match = part.match(/^:([a-zA-Z0-9_]+):$/);
      if (match && emoteMap[match[1]]) {
        return <img key={i} className="emote" src={emoteMap[match[1]]} alt={part} title={part} />;
      }
      return part;
    });
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
      case "emotes":
        if (event.chatId === currentChatRef.current) {
          getEmotes(event.chatId);
        }
        break;
      case "chat:joined":
        getChats();
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
              <button disabled={sidebarMode === "join"} onClick={() => {setSidebarMode("join"); if (loggedIn) getDiscoverable();}}>join</button>
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
                              {currentChat === chat.id ? <b>{chat.name}</b> : chat.name}
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
                    {!loggedIn ? (
                      <p>log in to browse chats</p>
                    ) : discoverList.length === 0 ? (
                      <p>no public chats found...</p>
                    ) : (
                      discoverList.map((chat) => (
                        <div className="chat_item" key={chat.id}>
                          <p>
                            <a href="" onClick={(e)=>{e.preventDefault();switchChat(chat.id)}}>{chat.name}</a>
                            {" "}
                            {chat.joined ? (
                              <span>(joined)</span>
                            ) : (
                              <a href="" onClick={(e)=>{e.preventDefault();handleJoinPublic(chat.id)}}>[join]</a>
                            )}
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
                  messages.map((msg) => (
                    <p key={msg.id}>
                      <span><b>{msg.sender_name}:</b></span>{" "}
                      {msg.data?.image ? (
                        <img className="chat_image" src={msg.data.image} alt="uploaded image" />
                      ) : (
                        renderMessageText(msg.message)
                      )}
                      {isAdmin ? (
                        <>
                          {" "}
                          <a href="" className="msg_delete" onClick={(e)=>{e.preventDefault();handleDeleteMessage(msg.id)}}>[x]</a>
                        </>
                      ) : null}
                    </p>
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
            {currentChat && chatInfo && showEmotes ? (
              <div id="emote_picker">
                {emotes.length === 0 ? (
                  <span>no emotes yet...</span>
                ) : (
                  emotes.map((emote) => (
                    <span key={emote.name} className="emote_entry">
                      <img className="emote" src={emote.url} alt={`:${emote.name}:`} title={`:${emote.name}:`}
                        onClick={() => setMessageInput((prev) => `${prev}:${emote.name}: `)} />
                      {isAdmin ? (
                        <a href="" onClick={(e)=>{e.preventDefault();handleDeleteEmote(emote.name)}}>[x]</a>
                      ) : null}
                    </span>
                  ))
                )}
                {isAdmin ? (
                  <span className="emote_add">
                    <input placeholder="emote name" value={newEmoteName} onChange={(e) => setNewEmoteName(e.target.value)} />
                    <button onClick={() => emoteFileRef.current?.click()}>upload emote</button>
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{display: "none"}} ref={emoteFileRef}
                      onChange={(e) => {handleAddEmote(e.target.files[0]); e.target.value = "";}} />
                  </span>
                ) : null}
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
                  <button onClick={() => fileInputRef.current?.click()}>img</button>
                  <button onClick={() => setShowEmotes(!showEmotes)}>emotes</button>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{display: "none"}} ref={fileInputRef}
                    onChange={(e) => {sendImage(e.target.files[0]); e.target.value = "";}} />
                </div>
              ) : (
                <div id="chat_input">
                  <button onClick={() => handleJoinPublic(currentChat)}>join chat to send messages</button>
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
            {currentChat && chatInfo && isAdmin ? (
              <div id="add_member">
                <input placeholder="add user" value={addMemberInput} onChange={(e) => setAddMemberInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }} />
                <button onClick={handleAddMember}>add</button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default App
