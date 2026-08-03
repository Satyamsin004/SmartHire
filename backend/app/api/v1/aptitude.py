from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.dependencies.auth import get_current_user
from app.models.domain import User

router = APIRouter(prefix="/aptitude", tags=["Aptitude Assessment"])

@router.get("/questions", response_model=List[Dict[str, Any]])
async def get_aptitude_questions(user: User = Depends(get_current_user)):
    return [
        {
            "id": "apt-101",
            "category": "Quantitative Ability",
            "question": "A train 150 meters long takes 20 seconds to cross a platform 250 meters long. What is the speed of the train in km/h?",
            "options": ["54 km/h", "72 km/h", "90 km/h", "108 km/h"],
            "correct_option": 1,
            "negative_marks": 0.25
        },
        {
            "id": "apt-102",
            "category": "Logical Reasoning",
            "question": "If 'CODES' is written as 'DPEFT' in a certain language, how is 'INTERVIEW' written in that language?",
            "options": ["JOUSSWJFX", "JOUSUJXJX", "JOUSFJXJX", "JOUSVJXJX"],
            "correct_option": 0,
            "negative_marks": 0.25
        },
        {
            "id": "apt-103",
            "category": "Verbal Ability",
            "question": "Identify the word that is opposite in meaning to 'EPHEMERAL':",
            "options": ["Transient", "Permanent", "Fleeting", "Short-lived"],
            "correct_option": 1,
            "negative_marks": 0.25
        }
    ]
