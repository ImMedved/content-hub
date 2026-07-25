import { useEffect, useRef } from "react";
import { resolveMediaUrl } from "../utils/media";

function HlsVideo({
    manifestUrl,
    posterUrl = "",
    autoPlay = false,
    className = ""
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

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = resolvedManifestUrl;
        } else {
            import("hls.js").then(({ default: Hls }) => {
                if (disposed || !Hls.isSupported()) {
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

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (!data.fatal) {
                        return;
                    }

                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                        return;
                    }

                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                        return;
                    }

                    hls.destroy();
                });
            });
        }

        return () => {
            disposed = true;

            if (hls) {
                hls.destroy();
            }

            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [manifestUrl]);

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
