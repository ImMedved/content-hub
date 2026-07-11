import { useEffect, useState } from "react";
import { getUserStatus } from "../api/user";

function useUserStatus(userId) {
    const [online, setOnline] = useState(false);

    useEffect(() => {
        if (!userId) {
            return;
        }

        let active = true;

        async function loadStatus() {
            try {
                const response = await getUserStatus(userId);

                if (active) {
                    setOnline(Boolean(response?.online));
                }
            } catch {
                if (active) {
                    setOnline(false);
                }
            }
        }

        loadStatus();
        const intervalId = setInterval(loadStatus, 60000);

        return () => {
            active = false;
            clearInterval(intervalId);
        };
    }, [userId]);

    return userId ? online : false;
}

export default useUserStatus;
