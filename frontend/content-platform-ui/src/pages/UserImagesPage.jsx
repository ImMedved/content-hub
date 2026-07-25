import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getImages } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import { getUserProfile } from "../api/user";
import EmptyState from "../components/EmptyState";
import ImageGrid from "../components/ImageGrid";
import ImageViewerModal from "../components/ImageViewerModal";
import { useAuth } from "../context/auth-context";

function UserImagesPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadImages = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [profileData, imageData] = await Promise.all([
                getUserProfile(id),
                getImages({ authorId: id, limit: 80 })
            ]);

            setProfile(profileData?.user || null);
            setImages(Array.isArray(imageData) ? imageData : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setImages([]);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadImages();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadImages]);

    const selectedIndex = selectedImage ? images.findIndex((item) => item.id === selectedImage.id) : -1;

    function navigateSelectedImage(direction) {
        if (selectedIndex < 0) {
            return;
        }

        const nextIndex = selectedIndex + direction;
        if (nextIndex >= 0 && nextIndex < images.length) {
            setSelectedImage(images[nextIndex]);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Images</h1>
                    {profile && <p className="page-subtitle">{profile.display_name || profile.username}</p>}
                </div>
                <Link className="btn btn--secondary" to={`/users/${id}`}>
                    Back to profile
                </Link>
            </div>

            {loading && <EmptyState>Loading images...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && (
                <ImageGrid images={images} onOpen={setSelectedImage} emptyText="No images yet." />
            )}

            <ImageViewerModal
                image={selectedImage}
                currentUserId={user?.id}
                onClose={() => setSelectedImage(null)}
                hasPrevious={selectedIndex > 0}
                hasNext={selectedIndex >= 0 && selectedIndex < images.length - 1}
                onNavigatePrevious={() => navigateSelectedImage(-1)}
                onNavigateNext={() => navigateSelectedImage(1)}
            />
        </div>
    );
}

export default UserImagesPage;
