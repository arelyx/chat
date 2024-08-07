import './App.css'

function App() {

  return (
    <>
    <div id="container">
      <div id="header">
        <div id="logo">
          <h1>chat</h1>
        </div>
        <div id="error">
          <div id="error_text">
            <p>error: </p>
          </div>
          <div>
            <button id="error_button">clear</button>
          </div>
        </div>
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
          {/* <div id="login">
            <div id="login_inputs">
              <input placeholder="username"></input>
              <input placeholder="password" type="password"></input>
            </div>
            <div id="login_buttons">
              <button>register</button>
              <button>login</button>
            </div>
          </div> */}
          <div id="user_container">
            <div id="username">
              <h3>username</h3>
            </div>
            <div id="logout">
              <button>logout</button>
            </div>
          </div>
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
