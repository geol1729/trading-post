import { ConsensusTopicId, MirrorClient, MirrorConsensusTopicQuery } from "@hashgraph/sdk";
import { Event } from "../domain/event";
import { handle } from "../store/events/handle";
import { ConsensusTopicIdLike } from "@hashgraph/sdk/lib/consensus/ConsensusTopicId";
import {getRunningHash} from "./hedera"
import state from "../store/state"
// Envoy Proxy
const MIRROR_NODE_ADDRESS = "https://grpc-web.api.testnet.kabuto.sh";

const mirrorClient = new MirrorClient(MIRROR_NODE_ADDRESS);

let isListening = false;

const textDecoder = new TextDecoder();

export function startListening(topicId: ConsensusTopicIdLike) {
    // Guard against being called multiple times
    if (isListening) return;
    isListening = true;

    // Assume that the topic _does_ exist
    new MirrorConsensusTopicQuery()
        .setTopicId(new ConsensusTopicId(topicId))
        .setStartTime(0)
        .subscribe(mirrorClient, (response) => {
            let data;

            console.debug("mirror", response.message);

            try {
                data = JSON.parse(textDecoder.decode(response.message));
                state.network.currentSequenceNumber = response.sequenceNumber;

            } catch (err) {
                // Event is unprocessable
                // No worries
                state.network.currentSequenceNumber += 1;
                console.warn(`unparseable message: ${response.message}`);
                return;
            }

            try {
                if (state.network.currentSequenceNumber > state.network.sequenceLength) {
                    getRunningHash(state.topicId!);
                }
            } catch (error) {
                console.log(error);
            }

            const event: Event = {
                id: response.sequenceNumber,
                timestamp: response.consensusTimestamp.asDate(),
                ...data
            };

            handle(event);
        }, (error) => {
            console.error(error);
        })
}
