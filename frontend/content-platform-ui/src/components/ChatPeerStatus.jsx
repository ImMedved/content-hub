import useUserStatus from "../utils/useUserStatus";

function ChatPeerStatus({ userId }) {
    const online = useUserStatus(userId);

    return (
        <span className={`online-indicator ${online ? "online-indicator--online" : ""}`}>
            {online ? "Online" : "Offline"}
        </span>
    );
}

export default ChatPeerStatus;
