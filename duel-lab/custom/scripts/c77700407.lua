--宵刻刃－白夜
--Dusk Hour Blade - White Night (original card)
local s,id=GetID()
local SET_YOIKOKU=0x7c3
local SET_YOIKOKU_BLADE=0x17c3
local CARD_POLAR_NIGHT=77700408
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Synchro Summon: 1 Tuner + 1+ non-Tuner monsters
	Synchro.AddProcedure(c,nil,1,1,Synchro.NonTuner(nil),1,99)
	--① Special Summoned: add 1 "Dusk Hour" card from your Deck/GY to hand
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.thtg)
	e1:SetOperation(s.thop)
	c:RegisterEffect(e1)
	--② opponent activates a card/effect: return 1 "Dusk Hour Blade" monster you control to hand/Extra Deck as cost, negate and destroy
	c:RegisterEffect(s.negate_effect(c,false))
	--"Dusk Hour Blade - Polar Night" with this card as material gains ② (Polar Night ①, once per turn under Polar Night's name)
	c:RegisterEffect(s.negate_effect(c,true))
end
s.listed_series={SET_YOIKOKU,SET_YOIKOKU_BLADE}
s.listed_names={CARD_POLAR_NIGHT}
function s.negate_effect(c,xmat)
	local e=Effect.CreateEffect(c)
	e:SetDescription(aux.Stringid(id,1))
	e:SetCategory(CATEGORY_NEGATE+CATEGORY_DESTROY)
	e:SetCode(EVENT_CHAINING)
	e:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)
	if xmat then
		e:SetType(EFFECT_TYPE_XMATERIAL+EFFECT_TYPE_QUICK_O)
		e:SetCountLimit(1,{CARD_POLAR_NIGHT,0})
		e:SetCondition(function(ef,tp,eg,ep,ev,re,r,rp)
			local xc=ef:GetHandler()
			return xc:IsCode(CARD_POLAR_NIGHT) and not xc:IsDisabled() and s.negcon(ef,tp,eg,ep,ev,re,r,rp)
		end)
	else
		e:SetType(EFFECT_TYPE_QUICK_O)
		e:SetRange(LOCATION_MZONE)
		e:SetCountLimit(1,{id,1})
		e:SetCondition(s.negcon)
	end
	e:SetCost(s.negcost)
	e:SetTarget(s.negtg)
	e:SetOperation(s.negop)
	return e
end
function s.thfilter(c)
	return c:IsSetCard(SET_YOIKOKU) and c:IsAbleToHand()
end
function s.thtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.thfilter,tp,LOCATION_DECK+LOCATION_GRAVE,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK+LOCATION_GRAVE)
end
function s.thop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local g=Duel.SelectMatchingCard(tp,s.thfilter,tp,LOCATION_DECK+LOCATION_GRAVE,0,1,1,nil)
	if #g>0 then Duel.SendtoHand(g,nil,REASON_EFFECT) Duel.ConfirmCards(1-tp,g) end
end
function s.negcon(e,tp,eg,ep,ev,re,r,rp)
	return rp==1-tp and not e:GetHandler():IsStatus(STATUS_BATTLE_DESTROYED) and Duel.IsChainNegatable(ev)
end
function s.costfilter(c)
	return c:IsFaceup() and c:IsSetCard(SET_YOIKOKU_BLADE) and (c:IsAbleToHandAsCost() or c:IsAbleToExtraAsCost())
end
function s.negcost(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.costfilter,tp,LOCATION_MZONE,0,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_RTOHAND)
	local g=Duel.SelectMatchingCard(tp,s.costfilter,tp,LOCATION_MZONE,0,1,1,nil)
	Duel.SendtoHand(g,nil,REASON_COST)
end
function s.negtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.SetOperationInfo(0,CATEGORY_NEGATE,eg,1,0,0)
	if re:GetHandler():IsDestructable() and re:GetHandler():IsRelateToEffect(re) then
		Duel.SetOperationInfo(0,CATEGORY_DESTROY,eg,1,0,0)
	end
end
function s.negop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.NegateActivation(ev) and re:GetHandler():IsRelateToEffect(re) then
		Duel.Destroy(eg,REASON_EFFECT)
	end
end
