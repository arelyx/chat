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
      }
    )
    .catch(
      (err) => {
        setError(`${err.response.data.error}`);
        setShowError(true);
      }
    )
  }

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
              <input placeholder="chat name"></input>
            </div>
            <div id="new_chat_button">
              <button>create</button>
            </div>
          </div>
          <div id="chats_container">
            <div id="chats">
              <p>chat 1</p>
              <p>chat 2</p>
              <p>chat 3</p>
              <p>chat 4</p>
              <p>chat 5</p>
              <p>chat 6</p>
              <p>chat 7</p>
              <p>chat 8</p>
              <p>chat 9</p>
              <p>chat 10</p>
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
            <div id="chat_header">
              <h3>chat header</h3>
            </div>
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
