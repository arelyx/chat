import './App.css'

function App() {

  return (
    <>
    <div id="container">
      <div id="header">
        <h1>chat</h1>
      </div>
      <div id="content">
        <div id="sidebar">
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
          <div id="account">
            <h3>account</h3>
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
