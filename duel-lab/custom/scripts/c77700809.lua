--呪われた勇者
--Cursed Hero (original card)
--② counts the "Cursed" Equip Cards equipped to this card. ① and ●5 send a face-up "Cursed" card you control
--(the ① cost has to be your own card; ●5 uses the same pool).
local s,id=GetID()
local SET_CURSED=0x7c7
local CARD_HERO_OF_HOPE=77700810
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 1 "Hero of Hope" equipped with an Equip Card
	Link.AddProcedure(c,s.matfilter,1,1)
	--① send 1 "Cursed" card on your field to the GY: banish 1 card on the field
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_REMOVE)
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetRange(LOCATION_MZONE)
	e1:SetCountLimit(1,{id,0},EFFECT_COUNT_CODE_OATH)
	e1:SetCost(s.rmcost)
	e1:SetTarget(s.rmtg)
	e1:SetOperation(s.rmop)
	c:RegisterEffect(e1)
	--② ●1+: cannot be Tributed, cannot be used as Link Material
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_SINGLE)
	e2:SetProperty(EFFECT_FLAG_SINGLE_RANGE+EFFECT_FLAG_CANNOT_DISABLE)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCode(EFFECT_UNRELEASABLE_SUM)
	e2:SetCondition(s.cntcon(1))
	e2:SetValue(1)
	c:RegisterEffect(e2)
	local e2b=e2:Clone()
	e2b:SetCode(EFFECT_UNRELEASABLE_NONSUM)
	c:RegisterEffect(e2b)
	local e2c=e2:Clone()
	e2c:SetCode(EFFECT_CANNOT_BE_LINK_MATERIAL)
	c:RegisterEffect(e2c)
	--●2+: double battle damage to the opponent
	local e3=Effect.CreateEffect(c)
	e3:SetType(EFFECT_TYPE_SINGLE)
	e3:SetProperty(EFFECT_FLAG_SINGLE_RANGE)
	e3:SetRange(LOCATION_MZONE)
	e3:SetCode(EFFECT_CHANGE_BATTLE_DAMAGE)
	e3:SetCondition(s.cntcon(2))
	e3:SetValue(aux.ChangeBattleDamage(1,DOUBLE_DAMAGE))
	c:RegisterEffect(e3)
	--●3+: gains ATK equal to the difference between both players' LP
	local e4=Effect.CreateEffect(c)
	e4:SetType(EFFECT_TYPE_SINGLE)
	e4:SetProperty(EFFECT_FLAG_SINGLE_RANGE)
	e4:SetRange(LOCATION_MZONE)
	e4:SetCode(EFFECT_UPDATE_ATTACK)
	e4:SetCondition(s.cntcon(3))
	e4:SetValue(function() return math.abs(Duel.GetLP(0)-Duel.GetLP(1)) end)
	c:RegisterEffect(e4)
	--●4+: face-up cards in your Spell & Trap Zones cannot be destroyed by card effects
	local e5=Effect.CreateEffect(c)
	e5:SetType(EFFECT_TYPE_FIELD)
	e5:SetRange(LOCATION_MZONE)
	e5:SetCode(EFFECT_INDESTRUCTABLE_EFFECT)
	e5:SetTargetRange(LOCATION_SZONE,0)
	e5:SetTarget(function(e,tc) return tc:IsFaceup() and tc:GetSequence()<5 end)
	e5:SetCondition(s.cntcon(4))
	e5:SetValue(1)
	c:RegisterEffect(e5)
	--●5+: when an opponent's effect resolves, you can send 1 "Cursed" card on your field to the GY to negate it
	--  (no limit on the number of uses, as written)
	local e6=Effect.CreateEffect(c)
	e6:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_CONTINUOUS)
	e6:SetCode(EVENT_CHAIN_SOLVING)
	e6:SetRange(LOCATION_MZONE)
	e6:SetCondition(s.negcon)
	e6:SetOperation(s.negop)
	c:RegisterEffect(e6)
end
s.listed_series={SET_CURSED}
s.listed_names={CARD_HERO_OF_HOPE}
function s.matfilter(c)
	return c:IsCode(CARD_HERO_OF_HOPE) and c:GetEquipCount()>0
end
function s.cursedcount(c)
	return c:GetEquipGroup():FilterCount(function(ec) return ec:IsFaceup() and ec:IsSetCard(SET_CURSED) end,nil)
end
function s.cntcon(n)
	return function(e) return s.cursedcount(e:GetHandler())>=n end
end
function s.cfilter(c,tp)
	return c:IsFaceup() and c:IsSetCard(SET_CURSED) and c:IsAbleToGraveAsCost()
		and Duel.IsExistingMatchingCard(Card.IsAbleToRemove,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,c)
end
function s.rmcost(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.cfilter,tp,LOCATION_ONFIELD,0,1,nil,tp) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,s.cfilter,tp,LOCATION_ONFIELD,0,1,1,nil,tp)
	Duel.SendtoGrave(g,REASON_COST)
end
function s.rmtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,nil,1,PLAYER_ALL,LOCATION_ONFIELD)
end
function s.rmop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectMatchingCard(tp,Card.IsAbleToRemove,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,1,nil)
	if #g>0 then
		Duel.HintSelection(g)
		Duel.Remove(g,POS_FACEUP,REASON_EFFECT)
	end
end
function s.gfilter(c)
	return c:IsFaceup() and c:IsSetCard(SET_CURSED) and c:IsAbleToGrave()
end
function s.negcon(e,tp,eg,ep,ev,re,r,rp)
	return rp==1-tp and Duel.IsChainDisablable(ev) and s.cursedcount(e:GetHandler())>=5
		and Duel.IsExistingMatchingCard(s.gfilter,tp,LOCATION_ONFIELD,0,1,nil)
end
function s.negop(e,tp,eg,ep,ev,re,r,rp)
	if not Duel.SelectEffectYesNo(tp,e:GetHandler(),aux.Stringid(id,1)) then return end
	Duel.Hint(HINT_CARD,0,id)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,s.gfilter,tp,LOCATION_ONFIELD,0,1,1,nil)
	if #g>0 and Duel.SendtoGrave(g,REASON_EFFECT)>0 then Duel.NegateEffect(ev) end
end
