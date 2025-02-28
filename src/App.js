
import React, { useEffect, useState } from "react";
import "amazon-connect-streams";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConnectClient, ListQuickConnectsCommand } from "@aws-sdk/client-connect";

const App = () => {
  const [agent, setAgent] = useState(null);
  const [contact, setContact] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [agentStatus, setAgentStatus] = useState("Loading...");
  const [callState, setCallState] = useState("Idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  const [agentQueue, setAgentQueue] = useState(null);
  const [quickConnects, setQuickConnects] = useState([]);
  const [filteredQuickConnects, setFilteredQuickConnects] = useState([]);
  const [selectedQuickConnectArn, setSelectedQuickConnectArn] = useState("");

  const [isValidState, setIsValidState] = useState(true);

  const AWS_REGION = "us-east-1"; // Update to your region
  const INSTANCE_ID = "451f789b-5e50-441a-a355-795ce8ba735f"; // Update to your instance ID

  

  const filterQuickConnects = () => {
    if (!agentQueue || agentQueue.length === 0) {
      console.warn("No agent queues provided for filtering.");
      return;
    }
    const filtered = quickConnects.filter(qc => {
      if (qc.QuickConnectType !== "QUEUE") return false;
      return agentQueue.includes(qc.Name);
    });
    console.log("Filtered Quick Connects:", filtered);
    setFilteredQuickConnects(filtered);
  };

  useEffect(() => {
    if (!window.connect) {
      console.error("❌ Amazon Connect Streams not loaded.");
      return;
    }

    console.log("✅ Amazon Connect Streams Loaded");

    window.connect.core.initCCP(document.getElementById("ccp-container"), {
      ccpUrl: "https://p3f-learn.my.connect.aws/ccp-v2/",
      loginPopup: true,
      softphone: { allowFramedSoftphone: true },
    });

    window.connect.agent((newAgent) => {
      if (!newAgent) {
        console.error("❌ Agent object is undefined!");
        return;
      }

      console.log("🔵 Agent Initialized:", newAgent);
      setAgent(newAgent);

      newAgent.onStateChange((agentStateChange) => {
        console.log("🔄 Agent State Changed:", agentStateChange);
        setAgentStatus(agentStateChange.newState);
      });

      const agentState = newAgent.getState();
      if (agentState) {
        console.log("✅ Initial Agent State:", agentState);
        setAgentStatus(agentState.name);
      } else {
        console.error("❌ Initial Agent State is undefined!");
      }
    });

    window.connect.contact((newContact) => {
      console.log("📞 New Contact Event:", newContact);
      setContact(newContact);

      if (newContact && typeof newContact.getQueue === "function") {
        const queue = newContact.getQueue();
        console.log("Full Agent Queue Object:", JSON.stringify(queue, null, 2));
        setAgentQueue(queue);
      } else {
        console.warn("Active contact or getQueue() not available.");
      }

      if (newContact.isInbound()) {
        console.log("📥 Incoming Call Detected");
        setCallState("Incoming Call");
      } else {
        console.log("📤 Outbound Call Detected");
        setCallState("Dialing...");
      }

      newContact.onConnected(() => {
        console.log("✅ Call Connected");
        setCallState("Busy");
        if (agent) {
          setAgentState("Busy");
        }

        const queue = newContact.getQueue();
        console.log("Connected Contact Queue Object:", JSON.stringify(queue, null, 2));
        setAgentQueue(queue);
      });

      newContact.onEnded(() => {
        console.log("🔴 Call Ended");
        setCallState("After Call Work");
        if (agent) {
          setAgentState("After Call Work");
        }

        setTimeout(() => {
          setCallState("Idle");
          setContact(null);
          if (agent) {
            setAgentState("Available");
          }
        }, 5000);
      });
    });

  }, []);

  useEffect(() => {
    if (!agentQueue) {
      const defaultQueue = { Name: "Sales" };
      console.warn("No queue identifier from getQueue(), using default:", defaultQueue);
      setAgentQueue(defaultQueue);
    }
  }, [agentQueue]);

  useEffect(() => {
    if (quickConnects.length > 0 && agentQueue) {
      const agentQueueName = agentQueue.Name;
      console.log("Using agentQueueName:", agentQueueName);
      const filtered = quickConnects.filter((qc) => {
        if (qc.QuickConnectType !== "QUEUE") return false;
        if (!qc.Name) {
          console.warn("Quick connect object missing Name:", qc);
          return false;
        }
        const agentQueueName = agentQueue && (agentQueue.Name || agentQueue.queueName);
        if (!agentQueueName) {
          console.warn("Agent queue identifier is missing.");
          return false;
        }
        return qc.Name.toLowerCase() === agentQueueName.toLowerCase();
      });
      console.log("Filtered Quick Connects:", filtered);
      setFilteredQuickConnects(filtered);
    }
  }, [quickConnects, agentQueue]);



  useEffect(() => {
    if (!agent) return;

    // Update state when agent status changes
    const updateAgentStatus = () => {
      const currentState = agent.getState().name; // Get the current state of the agent
      setAgentStatus(currentState);

      // Allow toggle only if agent is "Available" or "Offline"
      setIsValidState(currentState === "Available" || currentState === "Offline");
    };

    // Listen for state changes
    agent.onStateChange(updateAgentStatus);

    // Cleanup event listener when component unmounts
    return () => {
      agent.offStateChange(updateAgentStatus);
    };
  }, [agent]);



  const setAgentState = (stateName) => {
    if (!agent) {
      alert("Agent not initialized.");
      return;
    }

    const states = agent.getAgentStates();
    const newState = states.find((state) => state.name === stateName);
    if (newState) {
      agent.setState(newState, {
        success: () => {
          console.log(`✅ Agent status changed to: ${stateName}`);
          setAgentStatus(stateName);
        },
        failure: (err) => console.error("❌ Failed to change agent status:", err),
      });
    } else {
      console.error(`❌ Agent state "${stateName}" not found.`);
    }
  };

  const makeCall = () => {
    if (!phoneNumber || !agent) {
      alert("Enter a valid phone number and ensure the agent is initialized.");
      return;
    }
    try {
      const endpoint = window.connect.Endpoint.byPhoneNumber(phoneNumber);
      agent.connect(endpoint);
      setCallState("Dialing...");
    } catch (error) {
      console.error("❌ Error making call:", error);
    }
  };

  const acceptCall = () => {
    if (contact) {
      contact.accept();
      setCallState("In Call");
    }
  };

  const endCall = () => {
    if (contact) {
      contact.getInitialConnection().destroy();
      setCallState("After Call Work");
    }
  };

  const toggleMute = () => {
    if (agent) {
      isMuted ? agent.unmute() : agent.mute();
      setIsMuted(!isMuted);
    }
  };

  const toggleHold = () => {
    if (contact) {
      const connection = contact.getInitialConnection();
      if (connection) {
        isOnHold ? connection.resume() : connection.hold();
        setIsOnHold(!isOnHold);
      }
    }
  };

  const handleQuickConnectSelect = (selectedArn) => {
    const selectedQC = filteredQuickConnects.find(qc => qc.Arn === selectedArn);
    if (!selectedQC) {
      console.error("❌ Selected Quick Connect not found.");
    } else {
      console.log("✅ Selected Quick Connect:", selectedQC);
      initiateQuickConnect(selectedQC);
    }
  };

  const initiateQuickConnect = (quickConnect) => {
    if (!agent) {
      alert("Agent not initialized.");
      return;
    }

    const endpoint = window.connect.Endpoint.byQuickConnect(quickConnect.Arn);
    agent.connect(endpoint);
    setCallState("Dialing...");
  };

  const handleDropdownChange = (event) => {
    const selectedArn = event.target.value;
    setSelectedQuickConnectArn(selectedArn);
    handleQuickConnectSelect(selectedArn);
  };

  const toggleState = () => {
    if (!isValidState) {
      alert("Cannot change state while agent is busy.");
      return;
    }

    const newState = agentStatus === "Available" ? "Offline" : "Available";
    setAgentState(newState);
  };
  return (
    <div
      className="container-fluid d-flex justify-content-center align-items-center vh-100"
      style={{
        background: "linear-gradient(135deg, #007bff, #6610f2)",
      }}
    >
      <div className="container mt-4">
        <div className="row">
          {/* Left Panel - CCP Container */}
          <div className="col-md-4">
            <div
              id="ccp-container"
              className="border p-3 rounded bg-light shadow"
              style={{
                height: "550px",
                width: "100%",
                borderRadius: "15px",
              }}
            ></div>
          </div>

          {/* Right Panel - Agent Controls */}
          <div className="col-md-7">
            <div
              className="card shadow-lg p-4"
              style={{
                borderRadius: "15px",
                background: "rgba(255, 255, 255, 0.9)",
              }}
            >
              <div className="card-body">
                {/* Agent Status */}
                <h4 className="text-center mb-3">
                  Agent Status:{" "}
                  <span
                    className={`badge ${
                      agentStatus === "Available" ? "bg-success" : "bg-danger"
                    }`}
                  >
                    {agentStatus}
                  </span>
                </h4>

                {/* Toggle Button */}
                <div className="d-flex justify-content-center my-3">
                  <button
                    className={`btn mx-2 ${
                      agentStatus !== "Available"
                        ? "btn-success"
                        : "btn-danger"
                    }`}
                    onClick={toggleState}
                    disabled={!isValidState}
                    style={{
                      padding: "10px 20px",
                      fontSize: "18px",
                      transition: "0.3s ease",
                    }}
                  >
                    {isValidState ? (agentStatus ==="Available"?  "Offline" : "Available") : "Locked 🔒"}
                  </button>
                </div>

                {/* Call Status */}
                <h5 className="text-center">
                  Call Status:{" "}
                  <span className="badge bg-primary">{callState}</span>
                </h5>

                {/* Call Controls - Incoming */}
                {callState === "Incoming Call" && (
                  <div className="d-flex justify-content-center my-3">
                    <button
                      className="btn btn-success mx-2"
                      onClick={acceptCall}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      ✅ Accept
                    </button>
                    <button
                      className="btn btn-danger mx-2"
                      onClick={endCall}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}

                {/* Call Controls - Idle (Dialer) */}
                {callState === "Idle" && (
                  <div className="d-flex justify-content-center my-3">
                    <input
                      type="text"
                      className="form-control w-50 me-2"
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{ borderRadius: "10px" }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={makeCall}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      📞 Call
                    </button>
                  </div>
                )}

<div>
{callState === "Dialing..." && (
  <button onClick={endCall} className="bg-red-500 text-danger px-4 py-2 rounded">
    Cancel Call
  </button>
)}
</div>
                {/* Call Controls - Busy (Mute, Hold, End) */}
                {callState === "Busy" && (
                  <div className="d-flex justify-content-center my-3">
                    <button
                      className="btn btn-warning mx-2"
                      onClick={toggleMute}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      {isMuted ? "🔊 Unmute" : "🔇 Mute"}
                    </button>
                    <button
                      className="btn btn-secondary mx-2"
                      onClick={toggleHold}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      {isOnHold ? "▶️ Resume" : "⏸ Hold"}
                    </button>
                    <button
                      className="btn btn-danger mx-2"
                      onClick={endCall}
                      style={{ fontSize: "18px", padding: "10px 20px" }}
                    >
                      🔴 End Call
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Connects Dropdown */}
              <div className="mt-4">
                <h5 className="text-center">Quick Connects (Agent's Queues)</h5>
                <div className="d-flex justify-content-center">
                  <select
                    className="form-select w-50"
                    value={selectedQuickConnectArn}
                    onChange={handleDropdownChange}
                    style={{
                      borderRadius: "10px",
                      padding: "10px",
                      fontSize: "16px",
                    }}
                  >
                    <option value="">Select Quick Connect</option>
                    {filteredQuickConnects.map((qc) => (
                      <option key={qc.Id} value={qc.Arn}>
                        {qc.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;