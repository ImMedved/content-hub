import { useEffect, useRef } from "react";
import { resolveMediaUrl } from "../utils/media";

function HlsVideo({
    manifestUrl,
    posterUrl = "",
    autoPlay = false,
    className = "",
    onStatusChange = null,
    onError = null
}) {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;

        if (!video || !manifestUrl) {
            return undefined;
        }

        const resolvedManifestUrl = resolveMediaUrl(manifestUrl);
        let hls;
        let disposed = false;

        function reportStatus(nextStatus) {
            if (typeof onStatusChange === "function") {
                onStatusChange(nextStatus);
            }
        }

        function reportError(message) {
            if (typeof onError === "function") {
                onError(message);
            }
        }

        const handleLoadedMetadata = () => reportStatus("metadata loaded");
        const handleCanPlay = () => reportStatus("ready to play");
        const handleVideoError = () => {
            const mediaError = video.error;
            reportError(mediaError ? `HTML video error ${mediaError.code}` : "HTML video error");
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("canplay", handleCanPlay);
        video.addEventListener("error", handleVideoError);

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = resolvedManifestUrl;
        } else {
            import("hls.js").then(({ default: Hls }) => {
                if (disposed || !Hls.isSupported()) {
                    if (!disposed) {
                        reportError("HLS is not supported in this browser");
                    }
                    return;
                }

                hls = new Hls({
                    startLevel: -1,
                    capLevelToPlayerSize: true,
                    capLevelOnFPSDrop: true,
                    enableWorker: true,
                    autoStartLoad: true,
                    xhrSetup: (xhr) => {
                        xhr.withCredentials = true;
                    },
                    fetchSetup: (context, init) => new Request(context.url, {
                        ...init,
                        credentials: "include"
                    })
                });

                hls.loadSource(resolvedManifestUrl);
                hls.attachMedia(video);
                reportStatus("hls attached");

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    reportStatus("manifest parsed");
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    const details = data.details || data.type || "unknown";
                    const responseCode = data.response?.code ? ` HTTP ${data.response.code}` : "";
                    const message = `HLS ${data.fatal ? "fatal" : "warning"}: ${details}${responseCode}`;

                    if (!data.fatal) {
                        reportStatus(message);
                        return;
                    }

                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        reportError(`${message}. Retrying network load.`);
                        hls.startLoad();
                        return;
                    }

                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        reportError(`${message}. Trying media recovery.`);
                        hls.recoverMediaError();
                        return;
                    }

                    reportError(message);
                    hls.destroy();
                });
            }).catch((err) => {
                if (!disposed) {
                    reportError(`Unable to load hls.js: ${err.message}`);
                }
            });
        }

        return () => {
            disposed = true;

            if (hls) {
                hls.destroy();
            }

            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("canplay", handleCanPlay);
            video.removeEventListener("error", handleVideoError);

            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [manifestUrl, onError, onStatusChange]);

    return (
        <video
            ref={videoRef}
            className={className}
            controls
            playsInline
            muted={autoPlay}
            autoPlay={autoPlay}
            preload="metadata"
            poster={posterUrl ? resolveMediaUrl(posterUrl) : undefined}
        />
    );
}

export default HlsVideo;
