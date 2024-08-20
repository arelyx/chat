import {useState, useEffect} from "react"
import axios from "axios"

import './App.css'

function App() {
  const url = "http://localhost:3000";
  const [userToken, setUserToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [newChatName, setNewChatName] = useState("");
  const [currentChat, setCurrentChat] = useState("");
  const [chatName, setChatName] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    console.log("New chat name: ", newChatName);
  }, [newChatName]);

  const handleLogin = () => {
    console.log("Attempting login...");
    if (loginUsername === "" || loginPassword === "") {
      setError("Username or password is empty");
      setShowError(true);
      return;
    }
    axios.post(`${url}/login`, {
      username: loginUsername,
      password: loginPassword
    })
    .then(
      (res) => {
        console.log(`Successfully Logged In: ${JSON.stringify(res.data)}`);
        localStorage.setItem("token", res.data.token);
        setLoggedIn(true);
        setUserToken(res.data.token);
      }
    )
    .catch(
      (err) => {
        setError(`${err.response.data.error}`);
        setShowError(true);
      }
    )
  }

  const handleLogout = () => {
    console.log("Attempting logout...");
    localStorage.removeItem("token");
    setUserToken(null);
  }

  const handleRegister = () => {
    console.log("Attempting register...");
    if (loginUsername === "" || loginPassword === "") {
      setError("Username or password is empty");
      setShowError(true);
      return;
    }
    axios.post(`${url}/register`, {
      username: loginUsername,
      password: loginPassword
    })
    .then(
      (res) => {
        console.log(`Successfully Registered: ${JSON.stringify(res.data)}`);
        localStorage.setItem("token", res.data.token);
        setLoggedIn(true);
        setUsername(loginUsername);
        setUserToken(res.data.token);
      }
    )
    .catch(
      (err) => {
        setError(`${err.response.data.error}`);
        setShowError(true);
      }
    )
  }

  const getChats = () => {
    axios.get(`${url}/chats`)
    .then(
      (res) => {
        console.log(`ChatList: ${JSON.stringify(res.data)}`);
        setChatList(res.data);
        console.log(chatList);
      }
    )
    .catch(
      (err) => {
        setError(`${err.response.data.error}`);
        setShowError(true);
      }
    ) 
  }

  const handleChatCreate = () => {
    console.log("Attempting to create chat...");
    if (newChatName === "") {
      setError("new chat name is empty");
      setShowError(true);
      return;
    }
    axios.post(`${url}/chats`, {
      name: newChatName,
      admin: username,
    },
    {
      headers: {
      "Authorization": `Bearer ${userToken}`
      }
    })
    .then(
      (res) => {
        console.log(`Successfully created chat: ${JSON.stringify(res.data)}`);
        getChats();
      }
    )
    .catch(
      (err) => {
        console.log(err);
        setError(`${err.response.data.error}`);
        setShowError(true);
      }
    )
  }

  const switchChat = (chatId, chatName) => {
    console.log(`Switching to chat: ${chatId}`);
    axios.get(`${url}/chats/${chatId}`)
    .then(
      (res) => {
        console.log(`Chat: ${JSON.stringify(res.data)}`);
        setCurrentChat(chatId);
        console.log(chatName);
        setChatName(chatName);
        axios.get(`${url}/messages/${chatId}`)
        .then(
          (res) => {
            console.log(`Messages: ${JSON.stringify(res.data)}`);
            setMessages(res.data);
          }
        )
        .catch(
          (err) => {
            setError("Unable to get messages");
            setShowError(true);
          }
        )
      }
    ).catch(
      (err) => {
        setError("Unable to get chat");
        setShowError(true);
      }
    )
  }

  const handleChatDelete = () => {
    console.log("Attempting to delete chat...");
    axios.delete(`${url}/chats/${currentChat}`, {
      headers: {
        "Authorization": `Bearer ${userToken}`
      }
    })
    .then(
      () => {
        setCurrentChat(null);
        setChatName("");
        getChats();
      }
    )
    .catch(
      (err) => {
        setError("Unable to delete chat");
        setShowError(true);
      }
    )
  }

  useEffect(() => {
    getChats();
  }, []);

  useEffect(() => {
    if (userToken) {
      axios.get(`${url}/user`, {
        headers: {
          "Authorization": `Bearer ${userToken}`
        }
      })
      .then(
        (res) => {
          console.log(res.data);
          setLoggedIn(true);
          setUsername(res.data.name);
        }
      )
      .catch(
        (err) => {
          console.log(err);
          setLoggedIn(false);
          setuserToken("");
        }
      )
    }
    else {
      console.log("no token");
      setLoggedIn(false);
    }
  }, [userToken]);

  useEffect(() => {
    console.log(`loginUsername: ${loginUsername}, loginPassword: ${loginPassword}`);
  }, [loginUsername, loginPassword]);

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
      </div>
      <div id="content">
        <div id="sidebar">
        <div id="new_chat">
            <div id="new_chat_input">
              <input placeholder="chat name" onChange= {(e) => setNewChatName(e.target.value)}></input>
            </div>
            <div id="new_chat_button">
              <button onClick={handleChatCreate}>create</button>
            </div>
          </div>
          <div id="chats_container">
            <div id="chats">
              {chatList.map((chat) => {
                return (
                  <div id="chat">
                    <p key={chat.id} onClick={() => (console.log("clicked!"))}><a href="" onClick={(e)=>{e.preventDefault();switchChat(chat.id, chat.name)}}>{chat.name}</a></p>
                  </div>
                )
              }
            )}
            </div>
          </div>
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
        <div id="chatbox">
            {currentChat ? (
              <>
                <div id="chat_header">
                <div id="chat_name">
                  <h3>{chatName}</h3>
                </div>
                <div id="chat_options">
                  {/* <p>admin: username</p> */}
                  <button onClick={handleChatDelete}>delete chat</button>
                </div>
                </div>
              </>
            ) : (
              <>
              </>
            )}
            <div id="chat_window">
              <p><span>user1:</span> hello this is a relatively long message let's see what happens</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
              <p><span>user1:</span>hello</p>
            </div>
            <div id="chat_input">
              <input type="text" placeholder="send message" />
              <button>send</button>
            </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default App
