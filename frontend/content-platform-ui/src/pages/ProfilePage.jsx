import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { followUser, unfollowUser } from "../api/follow";
import { createImages, getImages } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import {
    getMyFollowing,
    getMyProfile,
    getUserFollowers,
    getUserFollowing,
    getUserProfile
} from "../api/user";
import EmptyState from "../components/EmptyState";
import ImageGrid from "../components/ImageGrid";
import ImageUploadModal from "../components/ImageUploadModal";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/useToast";
import { resolveMediaUrl } from "../utils/media";

function ProfilePage() {
    const { id = "me" } = useParams();
    const { user: currentUser } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef(null);
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [images, setImages] = useState([]);
    const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [myFollowingIds, setMyFollowingIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [error, setError] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError("");
        setActionMessage("");

        try {
            const profileResponse = id === "me"
                ? await getMyProfile()
                : await getUserProfile(id);
            const profileData = profileResponse?.user || null;

            if (!profileData?.id) {
                throw new Error("User was not found");
            }

            const [followersData, followingData, myFollowingData] = await Promise.all([
                getUserFollowers(profileData.id),
                getUserFollowing(profileData.id),
                getMyFollowing()
            ]);
            const imageData = await getImages({
                authorId: profileData.id,
                limit: 4
            });

            setProfile(profileData);
            setPosts(Array.isArray(profileResponse?.posts) ? profileResponse.posts : []);
            setImages(Array.isArray(imageData) ? imageData : []);
            setFollowers(Array.isArray(followersData) ? followersData : []);
            setFollowing(Array.isArray(followingData) ? followingData : []);
            setMyFollowingIds(Array.isArray(myFollowingData) ? myFollowingData.map((item) => item.id) : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setProfile(null);
            setPosts([]);
            setImages([]);
            setFollowers([]);
            setFollowing([]);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        async function initialLoad() {
            await loadProfile();
        }

        initialLoad();
    }, [id, loadProfile]);

    async function handleFollowToggle() {
        if (!profile?.id) {
            return;
        }

        setFollowLoading(true);
        setActionMessage("");
        setError("");

        try {
            if (myFollowingIds.includes(profile.id)) {
                await unfollowUser(profile.id);
                setMyFollowingIds((current) => current.filter((item) => item !== profile.id));
                setFollowers((current) => current.filter((item) => item.id !== currentUser?.id));
                setActionMessage("Unfollowed successfully.");
            } else {
                await followUser(profile.id);
                setMyFollowingIds((current) => [...current, profile.id]);
                if (currentUser) {
                    setFollowers((current) => current.some((item) => item.id === currentUser.id) ? current : [...current, currentUser]);
                }
                setActionMessage("Followed successfully.");
            }
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setFollowLoading(false);
        }
    }

    function handlePickImages() {
        fileInputRef.current?.click();
    }

    function handleImageFileChange(event) {
        const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
        event.target.value = "";

        if (files.length > 0) {
            setSelectedUploadFiles(files);
        }
    }

    async function uploadImages(uploadItems) {
        await createImages({ images: uploadItems });
        await loadProfile();
        showToast("Images uploaded", "success");
    }

    async function handleSubmitImages(uploadItems, options = {}) {
        setError("");

        if (options.background) {
            showToast("Image upload started", "success");
            uploadImages(uploadItems).catch((err) => {
                setError(getApiErrorMessage(err));
            });
            return;
        }

        setUploadingImages(true);

        try {
            await uploadImages(uploadItems);
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setUploadingImages(false);
        }
    }

    const isOwnProfile = profile?.id === currentUser?.id || id === "me";
    const isFollowingProfile = profile ? myFollowingIds.includes(profile.id) : false;

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Profile</h1>
                    {typeof profile?.wallet_balance === "number" && (
                        <p className="page-subtitle">Wallet balance: {profile.wallet_balance}</p>
                    )}
                </div>

                {isOwnProfile && (
                    <div className="page-actions">
                        <Link className="btn btn--secondary" to="/settings/profile">
                            Edit profile
                        </Link>
                        <Link className="btn btn--primary" to="/create">
                            Create post
                        </Link>
                        <button className="btn btn--secondary" type="button" onClick={handlePickImages}>
                            Upload image
                        </button>
                        <input
                            ref={fileInputRef}
                            className="visually-hidden"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageFileChange}
                        />
                    </div>
                )}
            </div>

            {loading && <div className="muted-box">Loading profile...</div>}
            {error && <div className="muted-box">{error}</div>}
            {actionMessage && <div className="muted-box">{actionMessage}</div>}

            {profile && !loading && (
                <div className="profile-layout">
                    <div className="profile-header">
                        <img
                            className="profile-avatar profile-avatar--image"
                            src={resolveMediaUrl(profile.avatar_url)}
                            alt=""
                        />

                        <div className="card profile-info">
                            <h2 className="profile-name">
                                {profile.display_name || profile.username || "User"}
                            </h2>
                            <p className="profile-username">@{profile.username || "unknown"}</p>
                            <p className="profile-bio">{profile.bio || "No bio yet."}</p>

                            <div className="profile-stats">
                                <span>Status: {profile.status || "active"}</span>
                                <span>Followers: {followers.length}</span>
                                <span>Following: {following.length}</span>
                                <span>Posts: {posts.length}</span>
                                <span>
                                    Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ""}
                                </span>
                            </div>

                            {!isOwnProfile && (
                                <div className="profile-actions">
                                    <button
                                        className="btn btn--secondary"
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                    >
                                        {followLoading ? "Saving..." : isFollowingProfile ? "Unfollow" : "Follow"}
                                    </button>
                                    {isFollowingProfile && (
                                        <Link className="btn btn--primary" to={`/messages/${profile.id}`}>
                                            Message
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="profile-lists">
                        <section className="card">
                            <div className="card__body">
                                <h3 className="page-title page-title--section">Followers</h3>
                                <div className="user-grid user-grid--compact">
                                    {followers.map((item) => (
                                        <Link key={`follower-${item.id}`} className="user-card" to={`/users/${item.id}`}>
                                            <img className="avatar avatar--sm" src={resolveMediaUrl(item.avatar_url)} alt="" />
                                            <div>
                                                <div className="user-card__name">{item.display_name || item.username}</div>
                                                <div className="user-card__meta">@{item.username}</div>
                                            </div>
                                        </Link>
                                    ))}
                                    {followers.length === 0 && <EmptyState>No followers yet.</EmptyState>}
                                </div>
                            </div>
                        </section>

                        <section className="card">
                            <div className="card__body">
                                <h3 className="page-title page-title--section">Following</h3>
                                <div className="user-grid user-grid--compact">
                                    {following.map((item) => (
                                        <Link key={`following-${item.id}`} className="user-card" to={`/users/${item.id}`}>
                                            <img className="avatar avatar--sm" src={resolveMediaUrl(item.avatar_url)} alt="" />
                                            <div>
                                                <div className="user-card__name">{item.display_name || item.username}</div>
                                                <div className="user-card__meta">@{item.username}</div>
                                            </div>
                                        </Link>
                                    ))}
                                    {following.length === 0 && <EmptyState>No subscriptions yet.</EmptyState>}
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="section-stack">
                        <div className="profile-panel__header">
                            <Link className="page-title page-title--section" to={`/users/${profile.id}/images`}>
                                Images
                            </Link>
                        </div>
                        <ImageGrid
                            images={images}
                            limit={4}
                            emptyText={isOwnProfile ? "No images yet. Upload one from your profile actions." : "No images yet."}
                        />
                    </section>

                    <section className="post-list">
                        <h3 className="page-title page-title--section">User posts</h3>
                        {posts.length === 0 && (
                            <EmptyState>
                                No posts yet. Try publishing something new or pinning a favorite once you do.
                            </EmptyState>
                        )}
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                onTagApply={null}
                                showManagementActions={isOwnProfile}
                                onPostDeleted={loadProfile}
                                onPostPinned={loadProfile}
                                animateOnScroll
                            />
                        ))}
                    </section>
                </div>
            )}

            {selectedUploadFiles.length > 0 && (
                <ImageUploadModal
                    files={selectedUploadFiles}
                    onClose={() => setSelectedUploadFiles([])}
                    onSubmit={handleSubmitImages}
                    submitting={uploadingImages}
                />
            )}
        </div>
    );
}

export default ProfilePage;

