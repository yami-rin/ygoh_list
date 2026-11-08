--嵐気流－強烈な吹き返し
--Storm Flow - Blowback (original card)
local s,id=GetID()
local SET_STORM_FLOW=0x7c1
function s.initial_effect(c)
	--① target 1 (or 2 if you control a WIND Synchro) opponent card: return 1 WIND monster you control and the target(s) to hand
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOHAND)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e1:SetCountLimit(1,id,EFFECT_COUNT_CODE_OATH)
	e1:SetTarget(s.target)
	e1:SetOperation(s.activate)
	c:RegisterEffect(e1)
end
s.listed_series={SET_STORM_FLOW}
function s.ownfilter(c)
	return c:IsFaceup() and c:IsAttribute(ATTRIBUTE_WIND) and c:IsAbleToHand()
end
function s.synfilter(c)
	return c:IsFaceup() and c:IsAttribute(ATTRIBUTE_WIND) and c:IsType(TYPE_SYNCHRO)
end
function s.target(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return chkc:IsOnField() and chkc:IsControler(1-tp) and chkc:IsAbleToHand() end
	if chk==0 then return Duel.IsExistingMatchingCard(s.ownfilter,tp,LOCATION_MZONE,0,1,nil)
		and Duel.IsExistingTarget(Card.IsAbleToHand,tp,0,LOCATION_ONFIELD,1,nil) end
	local max=Duel.IsExistingMatchingCard(s.synfilter,tp,LOCATION_MZONE,0,1,nil) and 2 or 1
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_RTOHAND)
	local g=Duel.SelectTarget(tp,Card.IsAbleToHand,tp,0,LOCATION_ONFIELD,1,max,nil)
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,g,#g+1,0,0)
end
function s.activate(e,tp,eg,ep,ev,re,r,rp)
	local tg=Duel.GetTargetCards(e)
	if #tg==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_RTOHAND)
	local g=Duel.SelectMatchingCard(tp,s.ownfilter,tp,LOCATION_MZONE,0,1,1,nil)
	if #g==0 then return end
	Duel.HintSelection(g)
	g:Merge(tg)
	Duel.SendtoHand(g,nil,REASON_EFFECT)
end
