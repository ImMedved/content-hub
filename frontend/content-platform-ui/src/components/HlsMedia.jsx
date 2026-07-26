import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../context/theme-context";
import { resolveMediaUrl } from "../utils/media";

function formatBitrate(value) {
    const bitrate = Number(value || 0);

    if (!bitrate) {
        return "";
    }

    return `${Math.round(bitrate / 1000)} kbps`;
}

function buildQualityLevels(levels, mediaType) {
    return levels.map((level, index) => {
        const height = Number(level.height || 0);
        const width = Number(level.width || 0);
        const bitrateLabel = formatBitrate(level.bitrate);
        const label = mediaType === "video" && height
            ? `${height}p${bitrateLabel ? ` (${bitrateLabel})` : ""}`
            : bitrateLabel || level.name || `Level ${index + 1}`;

        return {
            index,
            label,
            width,
            height,
            bitrate: Number(level.bitrate || 0)
        };
    });
}

function HlsMedia({
    mediaType = "video",
    manifestUrl,
    posterUrl = "",
    autoPlay = false,
    className = "",
    onStatusChange = null,
    onError = null
}) {
    const { audioQuality } = useTheme();
    const mediaRef = useRef(null);
    const hlsRef = useRef(null);
    const [qualityLevels, setQualityLevels] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState("auto");
    const [nativeMode, setNativeMode] = useState(false);
    const isVideo = mediaType === "video";

    const applyPreferredAudioQuality = useCallback((hls, levels) => {
        if (isVideo || !hls) {
            return;
        }

        if (audioQuality === "auto") {
            hls.currentLevel = -1;
            return;
        }

        const preferredBitrate = Number(audioQuality);
        const normalizedLevels = buildQualityLevels(levels || [], mediaType);
        const candidates = normalizedLevels
            .filter((level) => level.bitrate > 0)
            .sort((left, right) => left.bitrate - right.bitrate);

        if (candidates.length === 0) {
            hls.currentLevel = -1;
            return;
        }

        const matchingLevel =
            candidates.filter((level) => level.bitrate <= preferredBitrate).at(-1) ||
            candidates[candidates.length - 1];

        hls.currentLevel = matchingLevel.index;
        setSelectedLevel(String(matchingLevel.index));
    }, [audioQuality, isVideo, mediaType]);

    useEffect(() => {
        const media = mediaRef.current;

        if (!media || !manifestUrl) {
            return undefined;
        }

        const resolvedManifestUrl = resolveMediaUrl(manifestUrl);
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
        const handleMediaError = () => {
            const mediaError = media.error;
            reportError(mediaError ? `HTML ${mediaType} error ${mediaError.code}` : `HTML ${mediaType} error`);
        };

        setQualityLevels([]);
        setSelectedLevel("auto");
        setNativeMode(false);
        media.addEventListener("loadedmetadata", handleLoadedMetadata);
        media.addEventListener("canplay", handleCanPlay);
        media.addEventListener("error", handleMediaError);

        if (media.canPlayType("application/vnd.apple.mpegurl")) {
            setNativeMode(true);
            media.src = resolvedManifestUrl;
        } else {
            import("hls.js").then(({ default: Hls }) => {
                if (disposed || !Hls.isSupported()) {
                    if (!disposed) {
                        reportError("HLS is not supported in this browser");
                    }
                    return;
                }

                const hls = new Hls({
                    startLevel: -1,
                    capLevelToPlayerSize: isVideo,
                    capLevelOnFPSDrop: isVideo,
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

                hlsRef.current = hls;
                hls.loadSource(resolvedManifestUrl);
                hls.attachMedia(media);
                reportStatus("hls attached");

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setQualityLevels(buildQualityLevels(hls.levels || [], mediaType));
                    applyPreferredAudioQuality(hls, hls.levels || []);
                    reportStatus("manifest parsed");
                });

                hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                    if (hls.autoLevelEnabled) {
                        reportStatus(`auto quality: level ${Number(data.level) + 1}`);
                    }
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

            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }

            media.removeEventListener("loadedmetadata", handleLoadedMetadata);
            media.removeEventListener("canplay", handleCanPlay);
            media.removeEventListener("error", handleMediaError);

            media.pause();
            media.removeAttribute("src");
            media.load();
        };
    }, [applyPreferredAudioQuality, isVideo, manifestUrl, mediaType, onError, onStatusChange]);

    function handleQualityChange(event) {
        const value = event.target.value;
        setSelectedLevel(value);

        if (!hlsRef.current) {
            return;
        }

        hlsRef.current.currentLevel = value === "auto" ? -1 : Number(value);
    }

    const MediaTag = isVideo ? "video" : "audio";

    return (
        <div className={`hls-media hls-media--${mediaType}`}>
            <MediaTag
                ref={mediaRef}
                className={className}
                controls
                playsInline={isVideo}
                muted={isVideo && autoPlay}
                autoPlay={autoPlay}
                preload="metadata"
                poster={isVideo && posterUrl ? resolveMediaUrl(posterUrl) : undefined}
            />

            {isVideo && (qualityLevels.length > 1 || nativeMode) && (
                <label className="hls-media__quality">
                    <span>Quality</span>
                    <select
                        value={selectedLevel}
                        onChange={handleQualityChange}
                        disabled={nativeMode || qualityLevels.length <= 1}
                    >
                        <option value="auto">Auto</option>
                        {qualityLevels.map((level) => (
                            <option key={level.index} value={level.index}>
                                {level.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}
        </div>
    );
}

export default HlsMedia;
