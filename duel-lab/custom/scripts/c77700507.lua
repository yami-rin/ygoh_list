--連弾魔女の協調
--Canon Witch Connect (original card)
local s,id=GetID()
local SET_CANON_WITCH=0x7c4
function s.initial_effect(c)
	--Activate
	local e0=Effect.CreateEffect(c)
	e0:SetType(EFFECT_TYPE_ACTIVATE)
	e0:SetCode(EVENT_FREE_CHAIN)
	e0:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	c:RegisterEffect(e0)
	--① the opponent's monsters lose 300 ATK for each "Canon Witch" monster name you control
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetCode(EFFECT_UPDATE_ATTACK)
	e1:SetRange(LOCATION_SZONE)
	e1:SetTargetRange(0,LOCATION_MZONE)
	e1:SetValue(s.atkval)
	c:RegisterEffect(e1)
	--② a "Canon Witch" monster is Normal/Special Summoned: Special Summon 1 "Canon Witch" monster with a different name from the Deck
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,0))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_O)
	e2:SetProperty(EFFECT_FLAG_DELAY)
	e2:SetCode(EVENT_SUMMON_SUCCESS)
	e2:SetRange(LOCATION_SZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.spcon)
	e2:SetTarget(s.sptg)
	e2:SetOperation(s.spop)
	c:RegisterEffect(e2)
	local e3=e2:Clone()
	e3:SetCode(EVENT_SPSUMMON_SUCCESS)
	c:RegisterEffect(e3)
end
s.listed_series={SET_CANON_WITCH}
function s.atkval(e,c)
	local g=Duel.GetMatchingGroup(aux.FaceupFilter(Card.IsSetCard,SET_CANON_WITCH),e:GetHandlerPlayer(),LOCATION_MZONE,0,nil)
	return -300*g:GetClassCount(Card.GetCode)
end
function s.sumfilter(c)
	return c:IsFaceup() and c:IsSetCard(SET_CANON_WITCH)
end
function s.spcon(e,tp,eg,ep,ev,re,r,rp)
	return eg:IsExists(s.sumfilter,1,nil)
end
--different name from every "Canon Witch" monster that was just summoned
function s.spfilter(c,e,tp,eg)
	return c:IsSetCard(SET_CANON_WITCH) and c:IsMonster() and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
		and not eg:IsExists(function(sc) return s.sumfilter(sc) and sc:IsCode(c:GetCode()) end,1,nil)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_DECK,0,1,nil,e,tp,eg) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_DECK)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if not e:GetHandler():IsRelateToEffect(e) or Duel.GetLocationCount(tp,LOCATION_MZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local g=Duel.SelectMatchingCard(tp,s.spfilter,tp,LOCATION_DECK,0,1,1,nil,e,tp,eg)
	if #g>0 then Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP) end
end
