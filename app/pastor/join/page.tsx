import type { Metadata } from "next";
import ReviewerSignup from "./reviewer-signup";

export const metadata:Metadata={title:"목회자 검토 참여 | airChurch",robots:{index:false,follow:false}};

export default function ReviewerJoinPage() { return <ReviewerSignup />; }
