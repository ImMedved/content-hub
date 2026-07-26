import { useEffect, useMemo, useRef, useState } from "react";
import { createPlaybackSession } from "../api/media";
import { resolveMediaUrl } from "../utils/media";
import HlsAudio from "./HlsAudio";

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

function buildProcessingDetails(session) {
    const processing = session?.processing;

    if (!processing) {
        return "";
    }

    const parts = [];

    if (processing.jobStatus) {
        parts.push(`job: ${processing.jobStatus}`);
    }

    if (processing.errorCode) {
        parts.push(`code: ${processing.errorCode}`);
    }

    if (processing.errorMessage) {
        parts.push(processing.errorMessage);
    }

    return parts.join(" | ");
}

function LazyHlsAudio({
    src,
    mediaId = "",
    autoPlay = false
}) {
    const rootRef = useRef(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [manifestUrl, setManifestUrl] = useState(() => (isHlsUrl(src) ? src : ""));
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [details, setDetails] = useState("");
    const normalizedMediaId = mediaId || normalizeMediaId(src);
    const nativeAudioUrl = useMemo(() => {
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
                setDetails(buildProcessingDetails(session));
                setError("");
            } catch (err) {
                if (!cancelled) {
                    const responseError = err?.response?.data?.error;
                    const responseDetails = err?.response?.data?.data?.processing;
                    setDetails(responseDetails?.errorMessage || "");
                    setError(responseError || err.message || "Audio is unavailable");
                }
            }
        }

        loadSession();

        return () => {
            cancelled = true;
        };
    }, [manifestUrl, normalizedMediaId, shouldLoad]);

    return (
        <div ref={rootRef} className="hls-audio">
            {manifestUrl ? (
                <>
                    <HlsAudio
                        manifestUrl={manifestUrl}
                        autoPlay={autoPlay}
                        className="hls-audio__media"
                        onStatusChange={setStatus}
                        onError={setError}
                    />
                    {(error || details) && (
                        <div className="hls-audio__diagnostics">
                            {error && <div>{error}</div>}
                            {details && <div>{details}</div>}
                        </div>
                    )}
                </>
            ) : nativeAudioUrl ? (
                <audio
                    className="hls-audio__media"
                    src={resolveMediaUrl(nativeAudioUrl)}
                    controls
                    preload="metadata"
                />
            ) : (
                <div className="hls-audio__placeholder">
                    <div className="hls-audio__placeholder-title">
                        {error || (status ? `Audio status: ${status}` : "Preparing audio...")}
                    </div>
                    {details && (
                        <div className="hls-audio__placeholder-details">
                            {details}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default LazyHlsAudio;
