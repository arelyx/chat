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

  const chatWindowRef = useRef(null);

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
    setChatList([]);
    setCurrentChat("");
    setChatInfo(null);
    setMessages([]);
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
      setChatInfo(res.data);
      api.get(`/chats/${chatId}/messages`)
      .then((res) => {
        setMessages(res.data);
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch((err) => showErr(err, "Unable to get messages"));
    })
    .catch((err) => showErr(err, "Unable to get chat"));
  }

  const refreshChat = () => {
    if (currentChat) switchChat(currentChat);
  }

  const handleChatDelete = () => {
    api.delete(`/chats/${currentChat}`)
    .then(() => {
      setCurrentChat("");
      setChatInfo(null);
      setMessages([]);
      getChats();
    })
    .catch((err) => showErr(err, "Unable to delete chat"));
  }

  const handleLeave = () => {
    api.post(`/chats/${currentChat}/leave`)
    .then(() => {
      setCurrentChat("");
      setChatInfo(null);
      setMessages([]);
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
    .then(() => {
      setMessageInput("");
      api.get(`/chats/${currentChat}/messages`)
      .then((res) => {
        setMessages(res.data);
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch(() => {});
    })
    .catch((err) => showErr(err, "Unable to send message"));
  };

  useEffect(() => {
    getUsers();
  }, []);

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

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

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
            <div id="chat_window" ref={chatWindowRef}>
              {currentChat ? (
                messages.length > 0 ? (
                  messages.map((msg) => (
                    <p key={msg.id}>
                      <span><b>{msg.sender_name}:</b></span> {msg.message}
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
            {currentChat && chatInfo ? (
              isMember ? (
                <div id="chat_input">
                  <input
                    type="text"
                    placeholder="send message"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sendMessage();
                      }
                    }}
                  />
                  <button onClick={sendMessage}>send</button>
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
                      {member.user_name}
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
                    <p>{user.name}</p>
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
