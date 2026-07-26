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
    autoPlay = false,
    showProcessingDetails = true
}) {
    const rootRef = useRef(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [manifestUrl, setManifestUrl] = useState(() => (isHlsUrl(src) ? src : ""));
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [details, setDetails] = useState("");
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
                setDetails(buildProcessingDetails(session));
                setError("");
            } catch (err) {
                if (!cancelled) {
                    const responseError = err?.response?.data?.error;
                    const responseDetails = err?.response?.data?.data?.processing;
                    setDetails(responseDetails?.errorMessage || "");
                    setError(responseError || err.message || "Video is unavailable");
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
                <>
                    <HlsVideo
                        manifestUrl={manifestUrl}
                        posterUrl={posterUrl}
                        autoPlay={autoPlay}
                        className="hls-video__media"
                        onStatusChange={setStatus}
                        onError={setError}
                    />
                    {(error || (showProcessingDetails && details)) && (
                        <div className="hls-video__diagnostics">
                            {error && <div>{error}</div>}
                            {showProcessingDetails && details && <div>{details}</div>}
                        </div>
                    )}
                </>
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
                    <div className="hls-video__placeholder-title">
                        {error || (status ? `Video status: ${status}` : "Preparing video...")}
                    </div>
                    {showProcessingDetails && details && (
                        <div className="hls-video__placeholder-details">
                            {details}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
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

export default LazyHlsVideo;
