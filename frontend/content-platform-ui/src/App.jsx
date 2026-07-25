/*
App routes
- layout wrapper
*/

import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FeedPage from "./pages/FeedPage";
import CreatePostPage from "./pages/CreatePostPage";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import PostPage from "./pages/PostPage";
import FollowingPage from "./pages/FollowingPage";
import MessagesPage from "./pages/MessagesPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import EditPostPage from "./pages/EditPostPage";
import ImageFeedPage from "./pages/ImageFeedPage";
import UserImagesPage from "./pages/UserImagesPage";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/profile" element={<Navigate to="/users/me" replace />} />

                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <FeedPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/create"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <CreatePostPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/following"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <FollowingPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/messages"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <MessagesPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/images"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <ImageFeedPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/messages/new"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <NewChatPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/messages/:id"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <ChatPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/settings/profile"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <EditProfilePage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/users/me"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <ProfilePage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/users/:id"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <ProfilePage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/users/:id/images"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <UserImagesPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/posts/:id"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <PostPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/posts/:id/edit"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <EditPostPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
