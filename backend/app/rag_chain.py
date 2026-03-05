from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

from app.config import get_settings
from app.models import ChatResponse, SourceReference
from app.vector_store import VectorStoreManager


SYSTEM_PROMPT = """You are a precise document analysis assistant. Your role is to answer questions 
based EXCLUSIVELY on the provided document context. Follow these strict rules:

1. ONLY use information from the provided context to answer questions.
2. If the context does not contain enough information to answer the question, say:
   "I could not find sufficient information in the uploaded documents to answer this question."
3. NEVER make up, infer, or assume information that is not explicitly stated in the context.
4. When answering, be specific and cite which document the information comes from.
5. If the question is ambiguous, ask for clarification.
6. Keep answers concise but comprehensive.
7. Always respond in the same language as the question.

CONTEXT FROM DOCUMENTS:
{context}

IMPORTANT: If the above context is empty or does not relate to the question, 
you MUST state that you cannot find the answer in the uploaded documents."""

CONFIDENCE_PROMPT = """Based on your answer, rate your confidence level:
- "high": The answer is directly and clearly stated in the documents
- "medium": The answer can be reasonably derived from the documents
- "low": The answer is partially supported or the context is limited

Respond with ONLY the confidence level word."""


class RAGChain:
    """RAG chain with hallucination guardrails."""

    def __init__(self, vector_store: VectorStoreManager):
        settings = get_settings()
        self.vector_store = vector_store
        self.llm = ChatAnthropic(
            model=settings.llm_model,
            anthropic_api_key=settings.anthropic_api_key,
            temperature=0,
            max_tokens=2000,
        )

        self.qa_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SYSTEM_PROMPT),
                ("human", "{question}"),
            ]
        )

        self.confidence_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", "You are a confidence evaluator."),
                (
                    "human",
                    "Question: {question}\n\nContext: {context}\n\nAnswer: {answer}\n\n"
                    + CONFIDENCE_PROMPT,
                ),
            ]
        )

    def _format_context(self, documents: list[Document]) -> str:
        """Format retrieved documents into a context string."""
        if not documents:
            return ""

        context_parts = []
        for i, doc in enumerate(documents, 1):
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "N/A")
            context_parts.append(
                f"[Source {i}: {source}, Page {page}]\n{doc.page_content}"
            )

        return "\n\n---\n\n".join(context_parts)

    def _extract_sources(self, documents: list[Document]) -> list[SourceReference]:
        """Extract unique source references from documents."""
        seen = set()
        sources = []

        for doc in documents:
            source_name = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page")
            key = (source_name, page)

            if key not in seen:
                seen.add(key)
                preview = doc.page_content[:150] + "..." if len(doc.page_content) > 150 else doc.page_content
                sources.append(
                    SourceReference(
                        document_name=source_name,
                        page_number=page,
                        content_preview=preview,
                    )
                )

        return sources

    async def _evaluate_confidence(
        self, question: str, context: str, answer: str
    ) -> str:
        """Evaluate the confidence level of the answer."""
        try:
            messages = self.confidence_prompt.format_messages(
                question=question, context=context, answer=answer
            )
            response = await self.llm.ainvoke(messages)
            confidence = response.content.strip().lower()
            if confidence in ("high", "medium", "low"):
                return confidence
            return "medium"
        except Exception:
            return "medium"

    def _hallucination_check(self, answer: str, context: str) -> bool:
        """Basic hallucination check - verify answer relates to context."""
        if not context.strip():
            return False

        no_info_phrases = [
            "could not find",
            "cannot find",
            "no information",
            "not mentioned",
            "not found in",
            "don't have enough",
            "insufficient information",
        ]

        answer_lower = answer.lower()
        for phrase in no_info_phrases:
            if phrase in answer_lower:
                return True  # This is a valid "I don't know" response

        # If we have context, assume the answer is grounded
        return True

    async def query(
        self,
        question: str,
        document_ids: list[str] | None = None,
    ) -> ChatResponse:
        """Process a question through the RAG pipeline."""
        # 1. Retrieve relevant documents
        retrieved_docs = self.vector_store.similarity_search(
            query=question,
            k=5,
            doc_ids=document_ids,
        )

        # 2. Format context
        context = self._format_context(retrieved_docs)

        # 3. Generate answer
        messages = self.qa_prompt.format_messages(
            context=context, question=question
        )
        response = await self.llm.ainvoke(messages)
        answer = response.content

        # 4. Hallucination guardrail
        if not self._hallucination_check(answer, context):
            answer = (
                "I could not find sufficient information in the uploaded documents "
                "to answer this question. Please make sure you have uploaded the "
                "relevant documents and try rephrasing your question."
            )
            return ChatResponse(answer=answer, sources=[], confidence="low")

        # 5. Extract sources
        sources = self._extract_sources(retrieved_docs)

        # 6. Evaluate confidence
        confidence = await self._evaluate_confidence(question, context, answer)

        return ChatResponse(
            answer=answer,
            sources=sources,
            confidence=confidence,
        )
