import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/response";
import { getMyProfile, updateMe } from "../api/user";
import { useAuth } from "../context/auth-context";
import { resolveMediaUrl } from "../utils/media";

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function EditProfilePage() {
    const navigate = useNavigate();
    const { user: currentUser, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [error, setError] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [editForm, setEditForm] = useState({
        display_name: "",
        bio: "",
        status: "",
        avatar_url: ""
    });

    async function loadProfile() {
        setLoading(true);
        setError("");

        try {
            const profileResponse = await getMyProfile();
            const profileData = profileResponse?.user || null;

            if (!profileData?.id) {
                throw new Error("Unable to load your profile");
            }

            setEditForm({
                display_name: profileData.display_name || "",
                bio: profileData.bio || "",
                status: profileData.status || "",
                avatar_url: profileData.avatar_url || ""
            });
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadProfile();
        }

        initialLoad();
    }, []);

    async function handleProfileSave(event) {
        event.preventDefault();
        setSavingProfile(true);
        setError("");
        setActionMessage("");

        try {
            const payload = { ...editForm };

            if (avatarFile) {
                payload.avatar_file = await readFileAsDataUrl(avatarFile);
            }

            await updateMe(payload);
            await refreshUser();
            setActionMessage("Profile updated.");
            navigate("/users/me");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSavingProfile(false);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Edit profile</h1>
                    <p className="page-subtitle">Update your public information and avatar.</p>
                </div>

                <Link className="btn btn--secondary" to={currentUser?.id ? `/users/${currentUser.id}` : "/users/me"}>
                    Back to profile
                </Link>
            </div>

            {loading && <div className="muted-box">Loading profile editor...</div>}
            {error && <div className="muted-box">{error}</div>}
            {actionMessage && <div className="muted-box">{actionMessage}</div>}

            {!loading && (
                <div className="profile-editor-layout">
                    <div className="card profile-editor-preview">
                        <div className="card__body profile-editor-preview__body">
                            <img
                                className="profile-avatar profile-avatar--image"
                                src={resolveMediaUrl(editForm.avatar_url)}
                                alt=""
                            />
                            <div>
                                <h2 className="profile-name">
                                    {editForm.display_name || currentUser?.display_name || currentUser?.username || "User"}
                                </h2>
                                <p className="profile-username">@{currentUser?.username || "unknown"}</p>
                                <p className="profile-bio">{editForm.bio || "No bio yet."}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card__body">
                            <form className="form-grid" onSubmit={handleProfileSave}>
                                <label className="field">
                                    <span className="field__label">Display name</span>
                                    <input
                                        className="field__input"
                                        value={editForm.display_name}
                                        onChange={(event) => setEditForm((current) => ({
                                            ...current,
                                            display_name: event.target.value
                                        }))}
                                    />
                                </label>

                                <label className="field">
                                    <span className="field__label">Status</span>
                                    <input
                                        className="field__input"
                                        value={editForm.status}
                                        onChange={(event) => setEditForm((current) => ({
                                            ...current,
                                            status: event.target.value
                                        }))}
                                    />
                                </label>

                                <label className="field">
                                    <span className="field__label">Bio</span>
                                    <textarea
                                        className="field__textarea"
                                        value={editForm.bio}
                                        onChange={(event) => setEditForm((current) => ({
                                            ...current,
                                            bio: event.target.value
                                        }))}
                                    />
                                </label>

                                <label className="field">
                                    <span className="field__label">Avatar file</span>
                                    <input
                                        className="field__input"
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                                    />
                                </label>

                                <label className="field">
                                    <span className="field__label">Avatar URL fallback</span>
                                    <input
                                        className="field__input"
                                        value={editForm.avatar_url}
                                        onChange={(event) => setEditForm((current) => ({
                                            ...current,
                                            avatar_url: event.target.value
                                        }))}
                                        disabled={Boolean(avatarFile)}
                                    />
                                </label>

                                <div className="form-actions">
                                    <button className="btn btn--primary" type="submit" disabled={savingProfile}>
                                        {savingProfile ? "Saving..." : "Save profile"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EditProfilePage;
