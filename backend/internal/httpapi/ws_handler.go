package httpapi

import (
	"log"
	"net/http"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// syncRequest is the single message a client sends immediately after the
// handshake: the cursor of the newest entry it already has (a HistoryItem's
// "cursor" field), or nil/"" to sync from the very start of history.
type syncRequest struct {
	Cursor *string `json:"cursor"`
}

// HistorySyncHandler implements GET /api/v1/history/sync: a one-shot
// WebSocket backlog drain, not a live subscription. The client sends a
// cursor, the server streams every entry newer than it — oldest to newest,
// one HistoryItem JSON message each — then closes the connection. A caller
// that wants to stay current reconnects (e.g. after receiving a new
// calculation of its own) rather than holding the socket open.
func (a *API) HistorySyncHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, wsAcceptOptions())
	if err != nil {
		log.Printf("websocket accept failed: %v", err)
		return
	}
	defer conn.CloseNow()

	ctx := r.Context()

	if a.History == nil {
		conn.Close(websocket.StatusInternalError, "history is not available")
		return
	}

	var req syncRequest
	if err := wsjson.Read(ctx, conn, &req); err != nil {
		conn.Close(websocket.StatusPolicyViolation, `expected a JSON {"cursor"} payload`)
		return
	}

	raw := ""
	if req.Cursor != nil {
		raw = *req.Cursor
	}
	cursor, err := parseCursor(raw)
	if err != nil {
		conn.Close(websocket.StatusPolicyViolation, "invalid cursor")
		return
	}

	entries, err := a.History.ListSince(ctx, cursor)
	if err != nil {
		log.Printf("failed to list history since cursor: %v", err)
		conn.Close(websocket.StatusInternalError, "failed to load history")
		return
	}

	for _, entry := range entries {
		if err := wsjson.Write(ctx, conn, toHistoryItem(entry)); err != nil {
			log.Printf("failed to write history sync message: %v", err)
			return
		}
	}

	conn.Close(websocket.StatusNormalClosure, "")
}

// wsAcceptOptions mirrors withCORS's origin policy for the WebSocket
// handshake. "*" can't be used as an OriginPatterns entry (the library
// special-cases it as a footgun), so it maps to InsecureSkipVerify instead.
func wsAcceptOptions() *websocket.AcceptOptions {
	origin := allowedOrigin()
	if origin == "*" {
		return &websocket.AcceptOptions{InsecureSkipVerify: true}
	}
	return &websocket.AcceptOptions{OriginPatterns: []string{origin}}
}
