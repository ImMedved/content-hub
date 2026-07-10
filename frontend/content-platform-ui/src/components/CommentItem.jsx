/*
Comment item
*/

import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../utils/media";

function CommentItem({ comment, actions = null }) {
    return (
        <div className="comment-item">
            <div className="comment-item__meta">
                <Link className="comment-item__author-link" to={`/users/${comment.author_id}`}>
                    <img
                        className="avatar avatar--sm"
                        src={resolveMediaUrl(comment.author_avatar_url)}
                        alt=""
                    />
                    <span className="comment-item__author">
                        {comment.authorName || comment.author_username || `User #${comment.author_id ?? ""}`}
                    </span>
                </Link>
                <span>{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</span>
            </div>

            <div className="comment-item__text">{comment.content}</div>
            {actions && <div className="comment-item__actions">{actions}</div>}
        </div>
    );
}

export default CommentItem;
