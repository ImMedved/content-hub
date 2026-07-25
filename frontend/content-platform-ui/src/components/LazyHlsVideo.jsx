import { useEffect, useMemo, useRef, useState } from "react";
import { createPlaybackSession } from "../api/media";
import { resolveMediaUrl } from "../utils/media";
import HlsVideo from "./HlsVideo";

function isHlsUrl(value) {
    return String(value || "").toLowerCase().includes(".m3u8");
}

function normalizeMediaId(value) {
    const text = String(value || "").trim();

    if (!text.startsWith("hls:")) {
        return "";
    }

    return text.slice(4);
}

function LazyHlsVideo({
    src,
    mediaId = "",
    posterUrl = "",
    autoPlay = false
}) {
    const rootRef = useRef(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [manifestUrl, setManifestUrl] = useState(() => (isHlsUrl(src) ? src : ""));
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const normalizedMediaId = mediaId || normalizeMediaId(src);
    const nativeVideoUrl = useMemo(() => {
        if (normalizedMediaId || isHlsUrl(src)) {
            return "";
        }

        return src;
    }, [normalizedMediaId, src]);

    useEffect(() => {
        const element = rootRef.current;

        if (!element) {
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShouldLoad(true);
                }
            },
            {
                rootMargin: "360px 0px"
            }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!shouldLoad || !normalizedMediaId || manifestUrl) {
            return undefined;
        }

        let cancelled = false;

        async function loadSession() {
            try {
                const session = await createPlaybackSession(normalizedMediaId);

                if (cancelled) {
                    return;
                }

                setStatus(session.status || "");
                setManifestUrl(session.manifestUrl || "");
                setError("");
            } catch (err) {
                if (!cancelled) {
                    setError(err?.response?.data?.error || err.message || "Video is unavailable");
                }
            }
        }

        loadSession();

        return () => {
            cancelled = true;
        };
    }, [manifestUrl, normalizedMediaId, shouldLoad]);

    return (
        <div ref={rootRef} className="hls-video">
            {manifestUrl ? (
                <HlsVideo
                    manifestUrl={manifestUrl}
                    posterUrl={posterUrl}
                    autoPlay={autoPlay}
                    className="hls-video__media"
                />
            ) : nativeVideoUrl ? (
                <video
                    className="hls-video__media"
                    src={resolveMediaUrl(nativeVideoUrl)}
                    poster={posterUrl ? resolveMediaUrl(posterUrl) : undefined}
                    controls
                    playsInline
                    preload="metadata"
                />
            ) : (
                <div className="hls-video__placeholder">
                    {error || (status ? `Video status: ${status}` : "Preparing video...")}
                </div>
            )}
        </div>
    );
}

export default LazyHlsVideo;
