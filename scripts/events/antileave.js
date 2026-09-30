const replacementAccountId = "61594865882101";
const addingToThread = new Set();
const alreadyInThread = new Set();

module.exports = {
  config: {
    name: "antileave",
    version: "2.7",
    author: "EryXenX",
    category: "events"
  },

  onStart: async ({ api, event }) => {
    const { threadID, logMessageType, logMessageData = {} } = event;
    if (!threadID) return;

    if (logMessageType === "log:subscribe") {
      const addedParticipants = logMessageData.addedParticipants || [];
      if (!addedParticipants.some(participant => String(participant.userFbId) === replacementAccountId)) return;

      return async () => {
        alreadyInThread.add(String(threadID));
      };
    }

    if (logMessageType !== "log:unsubscribe") return;

    const threadKey = String(threadID);
    const leftID = String(logMessageData.leftParticipantFbId || "");

    return async () => {
      if (leftID === replacementAccountId) alreadyInThread.delete(threadKey);

      if (alreadyInThread.has(threadKey)) {
        console.info("[ANTILEAVE] Target account is already in this group; skipping.");
        return;
      }
      if (addingToThread.has(threadKey)) {
        console.info("[ANTILEAVE] An add request for this group is already in progress.");
        return;
      }

      addingToThread.add(threadKey);
      console.info("[ANTILEAVE] Leave event received; sending add request.");
      try {
        let addError = null;
        try {
          await api.addUserToGroup(replacementAccountId, threadID);
        } catch (error) {
          addError = error;
        }

        let threadInfo;
        try {
          threadInfo = await api.getThreadInfo(threadID);
        } catch (error) {
          console.error("[ANTILEAVE] Could not verify group membership:", error?.message || error);
          if (addError) console.error("[ANTILEAVE] Add request failed:", addError?.message || addError);
          return;
        }

        if (threadInfo.participantIDs?.some(id => String(id) === replacementAccountId)) {
          alreadyInThread.add(threadKey);
          console.info("[ANTILEAVE] Target account confirmed in the group.");
        } else if (addError) {
          console.error("[ANTILEAVE] Add request failed:", addError?.message || addError);
        } else {
          console.warn("[ANTILEAVE] Add request returned, but the target account is not listed in the group.");
        }
      } finally {
        addingToThread.delete(threadKey);
      }
    };
  }
};
