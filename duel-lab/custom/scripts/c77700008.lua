--連鎖律の干渉
--Chain Code Interference (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	--● send 1 "Chain Code" card from Deck to GY (add it to hand instead if activated as Chain Link 3+)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOGRAVE+CATEGORY_TOHAND+CATEGORY_SEARCH)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.tgtg)
	e1:SetOperation(s.tgop)
	c:RegisterEffect(e1)
	--● target up to 2 cards in either GY: banish them
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_REMOVE)
	e2:SetType(EFFECT_TYPE_ACTIVATE)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e2:SetCountLimit(1,{id,1})
	e2:SetTarget(s.rmtg)
	e2:SetOperation(s.rmop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
--Chain Link 3 or higher adds the card to the hand instead of sending it to the GY: check the action that will be done
function s.tgfilter(c,tohand)
	return c:IsSetCard(SET_CHAIN_CODE) and (tohand and c:IsAbleToHand() or not tohand and c:IsAbleToGrave())
end
function s.tgtg(e,tp,eg,ep,ev,re,r,rp,chk)
	--before activation this card is not on the chain yet: it would be the next Chain Link
	if chk==0 then return Duel.IsExistingMatchingCard(s.tgfilter,tp,LOCATION_DECK,0,1,nil,Duel.GetCurrentChain()+1>=3) end
	e:SetLabel(Duel.GetCurrentChain())
end
function s.tgop(e,tp,eg,ep,ev,re,r,rp)
	--activated as Chain Link 3 or higher: add to hand instead of sending to the GY
	local tohand=e:GetLabel()>=3
	local filter=function(c) return c:IsSetCard(SET_CHAIN_CODE) and (tohand and c:IsAbleToHand() or not tohand and c:IsAbleToGrave()) end
	Duel.Hint(HINT_SELECTMSG,tp,tohand and HINTMSG_ATOHAND or HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,filter,tp,LOCATION_DECK,0,1,1,nil)
	if #g==0 then return end
	if tohand then Duel.SendtoHand(g,nil,REASON_EFFECT) Duel.ConfirmCards(1-tp,g)
	else Duel.SendtoGrave(g,REASON_EFFECT) end
end
function s.rmtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return chkc:IsLocation(LOCATION_GRAVE) and chkc:IsAbleToRemove() end
	if chk==0 then return Duel.IsExistingTarget(Card.IsAbleToRemove,tp,LOCATION_GRAVE,LOCATION_GRAVE,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectTarget(tp,Card.IsAbleToRemove,tp,LOCATION_GRAVE,LOCATION_GRAVE,1,2,nil)
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,g,#g,0,0)
end
function s.rmop(e,tp,eg,ep,ev,re,r,rp)
	local g=Duel.GetTargetCards(e)
	if #g>0 then Duel.Remove(g,POS_FACEUP,REASON_EFFECT) end
end
